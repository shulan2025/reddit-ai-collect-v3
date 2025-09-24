import { Env } from '../types';

/**
 * 环境配置管理器
 * 负责环境变量的加载、验证和类型转换
 */
export class EnvironmentConfig {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * 验证所有必需的环境变量
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查必需的环境变量
    if (!this.env.DB) {
      errors.push('DB binding is required');
    }

    if (!this.env.REDDIT_CLIENT_ID) {
      errors.push('REDDIT_CLIENT_ID is required');
    }

    if (!this.env.REDDIT_CLIENT_SECRET) {
      errors.push('REDDIT_CLIENT_SECRET is required');
    }

    if (!this.env.REDDIT_USER_AGENT) {
      errors.push('REDDIT_USER_AGENT is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取每日采集限制
   */
  getDailyLimit(): number {
    return parseInt(this.env.DAILY_LIMIT || '2000');
  }

  /**
   * 获取单次API调用最大帖子数
   */
  getMaxPostsPerRequest(): number {
    return parseInt(this.env.MAX_POSTS_PER_REQUEST || '80');
  }

  /**
   * 获取最小点赞率
   */
  getMinUpvoteRatio(): number {
    return parseFloat(this.env.MIN_UPVOTE_RATIO || '0.1');
  }

  /**
   * 获取API请求间隔
   */
  getApiRequestInterval(): number {
    return parseInt(this.env.API_REQUEST_INTERVAL || '1000');
  }

  /**
   * 获取最大重试次数
   */
  getMaxRetries(): number {
    return parseInt(this.env.MAX_RETRIES || '3');
  }

  /**
   * 获取环境类型
   */
  getEnvironment(): 'development' | 'production' {
    return this.env.ENVIRONMENT === 'production' ? 'production' : 'development';
  }

  /**
   * 是否为开发环境
   */
  isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  /**
   * 是否为生产环境
   */
  isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  /**
   * 获取Reddit API配置
   */
  getRedditConfig() {
    return {
      clientId: this.env.REDDIT_CLIENT_ID,
      clientSecret: this.env.REDDIT_CLIENT_SECRET,
      userAgent: this.env.REDDIT_USER_AGENT,
      baseUrl: 'https://oauth.reddit.com',
      authUrl: 'https://www.reddit.com/api/v1/access_token'
    };
  }

  /**
   * 获取Google AI API密钥（可选）
   */
  getGoogleAiApiKey(): string | undefined {
    return this.env.GOOGLE_AI_API_KEY;
  }

  /**
   * 获取完整配置对象
   */
  getConfig() {
    return {
      environment: this.getEnvironment(),
      dailyLimit: this.getDailyLimit(),
      maxPostsPerRequest: this.getMaxPostsPerRequest(),
      minUpvoteRatio: this.getMinUpvoteRatio(),
      apiRequestInterval: this.getApiRequestInterval(),
      maxRetries: this.getMaxRetries(),
      reddit: this.getRedditConfig(),
      googleAiApiKey: this.getGoogleAiApiKey()
    };
  }

  /**
   * 打印配置信息（隐藏敏感信息）
   */
  printConfig(): string {
    const config = this.getConfig();
    const safeConfig = {
      ...config,
      reddit: {
        ...config.reddit,
        clientSecret: '***hidden***'
      },
      googleAiApiKey: config.googleAiApiKey ? '***hidden***' : undefined
    };
    
    return JSON.stringify(safeConfig, null, 2);
  }
}

/**
 * 创建环境配置实例
 */
export function createEnvironmentConfig(env: Env): EnvironmentConfig {
  return new EnvironmentConfig(env);
}

/**
 * 验证环境配置并抛出错误（如果无效）
 */
export function validateEnvironmentOrThrow(env: Env): EnvironmentConfig {
  const config = createEnvironmentConfig(env);
  const validation = config.validate();
  
  if (!validation.isValid) {
    throw new Error(`Environment validation failed: ${validation.errors.join(', ')}`);
  }
  
  return config;
}
