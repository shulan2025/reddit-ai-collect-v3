import { Logger } from '../../types';
import { sleep } from '../../utils/helpers';

/**
 * Reddit API认证管理器
 * 负责OAuth2认证、令牌管理和刷新
 */
export class RedditAuthManager {
  private clientId: string;
  private clientSecret: string;
  private userAgent: string;
  private logger: Logger;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private isRefreshing: boolean = false;

  constructor(
    clientId: string,
    clientSecret: string,
    userAgent: string,
    logger: Logger
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.userAgent = userAgent;
    this.logger = logger.child('Auth');
  }

  /**
   * 获取有效的访问令牌
   */
  async getAccessToken(): Promise<string> {
    // 如果令牌仍然有效，直接返回
    if (this.accessToken && this.isTokenValid()) {
      return this.accessToken;
    }

    // 如果正在刷新，等待完成
    if (this.isRefreshing) {
      await this.waitForRefresh();
      if (this.accessToken && this.isTokenValid()) {
        return this.accessToken;
      }
    }

    // 刷新或获取新令牌
    return await this.refreshToken();
  }

  /**
   * 检查令牌是否有效（提前5分钟过期）
   */
  private isTokenValid(): boolean {
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // 5分钟缓冲
    return this.tokenExpiry > (now + bufferTime);
  }

  /**
   * 等待正在进行的刷新操作完成
   */
  private async waitForRefresh(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 30; // 最多等待30秒
    
    while (this.isRefreshing && attempts < maxAttempts) {
      await sleep(1000);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      this.logger.warn('Token refresh timeout, proceeding anyway');
      this.isRefreshing = false;
    }
  }

  /**
   * 刷新访问令牌
   */
  private async refreshToken(): Promise<string> {
    if (this.isRefreshing) {
      await this.waitForRefresh();
      if (this.accessToken && this.isTokenValid()) {
        return this.accessToken;
      }
    }

    this.isRefreshing = true;
    const startTime = Date.now();

    try {
      this.logger.debug('Refreshing Reddit access token');

      const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
      
      const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent
        },
        body: 'grant_type=client_credentials'
      });

      const duration = Date.now() - startTime;
      this.logger.apiCall('POST', 'https://www.reddit.com/api/v1/access_token', response.status, duration);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as {
        access_token: string;
        token_type: string;
        expires_in: number;
        scope: string;
      };

      if (!data.access_token) {
        throw new Error('No access token in response');
      }

      // 更新令牌信息
      this.accessToken = data.access_token;
      this.tokenExpiry = Math.floor(Date.now() / 1000) + data.expires_in;

      this.logger.info('Reddit access token refreshed successfully', {
        tokenType: data.token_type,
        expiresIn: data.expires_in,
        scope: data.scope,
        expiryTime: new Date(this.tokenExpiry * 1000).toISOString()
      });

      return this.accessToken;

    } catch (error) {
      this.logger.error('Failed to refresh Reddit access token', {
        error: error.message,
        clientId: this.clientId.substring(0, 8) + '***' // 只显示前8位
      });
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * 验证认证配置
   */
  async validateCredentials(): Promise<{ isValid: boolean; error?: string }> {
    try {
      const token = await this.getAccessToken();
      
      // 测试API调用
      const testResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': this.userAgent
        }
      });

      if (testResponse.ok) {
        const userData = await testResponse.json();
        this.logger.info('Credentials validated successfully', {
          hasUserData: !!userData,
          status: testResponse.status
        });
        return { isValid: true };
      } else {
        const errorText = await testResponse.text();
        return { 
          isValid: false, 
          error: `API test failed: ${testResponse.status} - ${errorText}` 
        };
      }
    } catch (error) {
      return { 
        isValid: false, 
        error: `Credential validation failed: ${error.message}` 
      };
    }
  }

  /**
   * 获取认证头
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    
    return {
      'Authorization': `Bearer ${token}`,
      'User-Agent': this.userAgent,
      'Content-Type': 'application/json'
    };
  }

  /**
   * 清除令牌（强制重新认证）
   */
  clearToken(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.logger.debug('Access token cleared');
  }

  /**
   * 获取令牌状态信息
   */
  getTokenStatus(): {
    hasToken: boolean;
    isValid: boolean;
    expiryTime: string | null;
    timeToExpiry: number | null;
  } {
    const hasToken = !!this.accessToken;
    const isValid = hasToken && this.isTokenValid();
    const expiryTime = this.tokenExpiry > 0 
      ? new Date(this.tokenExpiry * 1000).toISOString()
      : null;
    const timeToExpiry = this.tokenExpiry > 0 
      ? this.tokenExpiry - Math.floor(Date.now() / 1000)
      : null;

    return {
      hasToken,
      isValid,
      expiryTime,
      timeToExpiry
    };
  }

  /**
   * 处理认证错误
   */
  handleAuthError(response: Response): boolean {
    if (response.status === 401) {
      this.logger.warn('Authentication failed, clearing token');
      this.clearToken();
      return true; // 表示需要重试
    }
    return false; // 不需要重试
  }

  /**
   * 检查是否需要认证重试
   */
  shouldRetryAuth(error: Error): boolean {
    const authErrorMessages = [
      'invalid_token',
      'token_expired',
      'unauthorized',
      '401'
    ];

    const errorMessage = error.message.toLowerCase();
    return authErrorMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * 获取用户代理字符串
   */
  getUserAgent(): string {
    return this.userAgent;
  }

  /**
   * 更新用户代理
   */
  setUserAgent(userAgent: string): void {
    this.userAgent = userAgent;
    this.logger.debug('User agent updated', { userAgent });
  }
}
