import { Logger, RedditPost, RedditAPIResponse } from '../../types';
import { RedditAuthManager } from './auth-manager';
import { RedditRateLimiter } from './rate-limiter';
import { RedditPostModel } from '../storage/models/reddit-post';
import { retry, isPostWithinTimeRange, safeGet } from '../../utils/helpers';

/**
 * Reddit API客户端
 * 负责与Reddit API的交互，包括帖子获取、认证和错误处理
 */
export class RedditClient {
  private authManager: RedditAuthManager;
  private rateLimiter: RedditRateLimiter;
  private logger: Logger;
  private baseUrl: string = 'https://oauth.reddit.com';
  private maxRetries: number;

  constructor(
    clientId: string,
    clientSecret: string,
    userAgent: string,
    logger: Logger,
    options: {
      maxRetries?: number;
      minIntervalMs?: number;
      maxRequestsPerMinute?: number;
      maxRequestsPerHour?: number;
    } = {}
  ) {
    this.logger = logger.child('RedditClient');
    this.maxRetries = options.maxRetries || 3;

    // 初始化认证管理器
    this.authManager = new RedditAuthManager(
      clientId,
      clientSecret,
      userAgent,
      this.logger
    );

    // 初始化频率限制器
    this.rateLimiter = new RedditRateLimiter(this.logger, {
      minIntervalMs: options.minIntervalMs || 1000,
      maxRequestsPerMinute: options.maxRequestsPerMinute || 60,
      maxRequestsPerHour: options.maxRequestsPerHour || 3600
    });
  }

  /**
   * 验证API连接
   */
  async validateConnection(): Promise<{ isValid: boolean; error?: string }> {
    try {
      this.logger.info('Validating Reddit API connection');
      const validation = await this.authManager.validateCredentials();
      
      if (validation.isValid) {
        this.logger.info('Reddit API connection validated successfully');
      } else {
        this.logger.error('Reddit API connection validation failed', {
          error: validation.error
        });
      }
      
      return validation;
    } catch (error) {
      this.logger.error('Reddit API connection validation error', {
        error: error.message
      });
      return { isValid: false, error: error.message };
    }
  }

  /**
   * 从指定subreddit获取帖子
   */
  async getSubredditPosts(
    subreddit: string,
    options: {
      sort?: 'hot' | 'new' | 'top' | 'rising';
      timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limit?: number;
      maxAgeHours?: number;
    } = {}
  ): Promise<RedditPost[]> {
    const {
      sort = 'hot',
      timeframe = 'day',
      limit = 80,
      maxAgeHours = 720 // 30天
    } = options;

    this.logger.info('Fetching posts from subreddit', {
      subreddit,
      sort,
      timeframe,
      limit,
      maxAgeHours
    });

    try {
      // 构建URL
      const url = this.buildSubredditUrl(subreddit, sort, timeframe, limit);
      
      // 发送请求
      const response = await this.makeRequest(url);
      const data = await response.json() as RedditAPIResponse;

      // 解析帖子数据
      const posts = this.parsePostsFromResponse(data);
      
      // 过滤时间范围
      const filteredPosts = posts.filter(post => 
        isPostWithinTimeRange(post.created_utc, maxAgeHours)
      );

      this.logger.info('Posts fetched successfully', {
        subreddit,
        totalPosts: posts.length,
        filteredPosts: filteredPosts.length,
        sort,
        limit
      });

      return filteredPosts;

    } catch (error) {
      this.logger.error('Failed to fetch subreddit posts', {
        subreddit,
        sort,
        limit,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 批量获取多个subreddit的帖子
   */
  async getMultipleSubredditPosts(
    subreddits: string[],
    options: {
      sort?: 'hot' | 'new' | 'top' | 'rising';
      timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limitPerSubreddit?: number;
      maxAgeHours?: number;
      concurrency?: number;
    } = {}
  ): Promise<Map<string, RedditPost[]>> {
    const {
      sort = 'hot',
      timeframe = 'day',
      limitPerSubreddit = 80,
      maxAgeHours = 720,
      concurrency = 1 // Reddit API建议顺序调用
    } = options;

    this.logger.info('Fetching posts from multiple subreddits', {
      subredditCount: subreddits.length,
      sort,
      limitPerSubreddit,
      concurrency
    });

    const results = new Map<string, RedditPost[]>();
    const errors: Array<{ subreddit: string; error: string }> = [];

    // 顺序处理（遵守频率限制）
    for (const subreddit of subreddits) {
      try {
        const posts = await this.getSubredditPosts(subreddit, {
          sort,
          timeframe,
          limit: limitPerSubreddit,
          maxAgeHours
        });
        results.set(subreddit, posts);
      } catch (error) {
        this.logger.error('Failed to fetch posts from subreddit', {
          subreddit,
          error: error.message
        });
        errors.push({ subreddit, error: error.message });
        results.set(subreddit, []); // 设置为空数组，避免后续处理出错
      }
    }

    this.logger.info('Batch subreddit fetch completed', {
      totalSubreddits: subreddits.length,
      successfulSubreddits: results.size - errors.length,
      failedSubreddits: errors.length,
      totalPosts: Array.from(results.values()).reduce((sum, posts) => sum + posts.length, 0)
    });

    if (errors.length > 0) {
      this.logger.warn('Some subreddits failed to fetch', { errors });
    }

    return results;
  }

  /**
   * 搜索帖子
   */
  async searchPosts(
    query: string,
    options: {
      subreddit?: string;
      sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
      timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limit?: number;
      maxAgeHours?: number;
    } = {}
  ): Promise<RedditPost[]> {
    const {
      subreddit,
      sort = 'relevance',
      timeframe = 'week',
      limit = 80,
      maxAgeHours = 720
    } = options;

    this.logger.info('Searching posts', {
      query,
      subreddit,
      sort,
      limit
    });

    try {
      // 构建搜索URL
      const url = this.buildSearchUrl(query, subreddit, sort, timeframe, limit);
      
      // 发送请求
      const response = await this.makeRequest(url);
      const data = await response.json() as RedditAPIResponse;

      // 解析帖子数据
      const posts = this.parsePostsFromResponse(data);
      
      // 过滤时间范围
      const filteredPosts = posts.filter(post => 
        isPostWithinTimeRange(post.created_utc, maxAgeHours)
      );

      this.logger.info('Search completed successfully', {
        query,
        totalPosts: posts.length,
        filteredPosts: filteredPosts.length
      });

      return filteredPosts;

    } catch (error) {
      this.logger.error('Search failed', {
        query,
        subreddit,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 构建subreddit URL
   */
  private buildSubredditUrl(
    subreddit: string,
    sort: string,
    timeframe: string,
    limit: number
  ): string {
    let url = `${this.baseUrl}/r/${subreddit}/${sort}.json?limit=${limit}&raw_json=1`;
    
    if (sort === 'top' && timeframe) {
      url += `&t=${timeframe}`;
    }
    
    return url;
  }

  /**
   * 构建搜索URL
   */
  private buildSearchUrl(
    query: string,
    subreddit: string | undefined,
    sort: string,
    timeframe: string,
    limit: number
  ): string {
    const encodedQuery = encodeURIComponent(query);
    let url = `${this.baseUrl}/search.json?q=${encodedQuery}&sort=${sort}&limit=${limit}&raw_json=1`;
    
    if (subreddit) {
      url += `&restrict_sr=on&sr_detail=1`;
      url = `${this.baseUrl}/r/${subreddit}/search.json?q=${encodedQuery}&sort=${sort}&limit=${limit}&restrict_sr=on&raw_json=1`;
    }
    
    if (sort === 'top' && timeframe) {
      url += `&t=${timeframe}`;
    }
    
    return url;
  }

  /**
   * 发送HTTP请求
   */
  private async makeRequest(url: string): Promise<Response> {
    return await retry(async () => {
      // 等待频率限制
      await this.rateLimiter.waitForRequest();

      // 获取认证头
      const headers = await this.authManager.getAuthHeaders();
      
      const startTime = Date.now();
      
      // 发送请求
      const response = await fetch(url, { headers });
      
      const duration = Date.now() - startTime;
      this.logger.apiCall('GET', url, response.status, duration);

      // 处理频率限制头
      this.rateLimiter.handleRateLimitHeaders(response.headers);

      // 处理错误响应
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return response;
    }, this.maxRetries, 1000, 2);
  }

  /**
   * 处理错误响应
   */
  private async handleErrorResponse(response: Response): Promise<void> {
    const status = response.status;
    const statusText = response.statusText;

    // 处理认证错误
    if (status === 401) {
      const shouldRetry = this.authManager.handleAuthError(response);
      if (shouldRetry) {
        throw new Error(`Authentication failed: ${status} ${statusText}`);
      }
    }

    // 处理频率限制
    if (status === 429) {
      await this.rateLimiter.handle429Error(response);
      throw new Error(`Rate limit exceeded: ${status} ${statusText}`);
    }

    // 处理其他错误
    let errorMessage = `HTTP ${status}: ${statusText}`;
    try {
      const errorData = await response.text();
      if (errorData) {
        errorMessage += ` - ${errorData}`;
      }
    } catch {
      // 忽略解析错误
    }

    throw new Error(errorMessage);
  }

  /**
   * 从API响应中解析帖子数据
   */
  private parsePostsFromResponse(data: RedditAPIResponse): RedditPost[] {
    try {
      const listing = safeGet(data, 'data', null);
      if (!listing) {
        this.logger.warn('No data in API response');
        return [];
      }

      const children = safeGet(listing, 'children', []);
      if (!Array.isArray(children)) {
        this.logger.warn('Invalid children format in API response');
        return [];
      }

      const posts: RedditPost[] = [];
      
      for (const child of children) {
        const postData = safeGet(child, 'data', null);
        if (!postData) continue;

        const post = RedditPostModel.fromRedditAPI(postData);
        if (post) {
          posts.push(post);
        }
      }

      this.logger.debug('Parsed posts from API response', {
        rawChildren: children.length,
        validPosts: posts.length
      });

      return posts;

    } catch (error) {
      this.logger.error('Failed to parse posts from API response', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * 获取客户端状态
   */
  getStatus(): {
    auth: ReturnType<RedditAuthManager['getTokenStatus']>;
    rateLimit: ReturnType<RedditRateLimiter['getStatus']>;
    requestStats: ReturnType<RedditRateLimiter['getRequestStats']>;
  } {
    return {
      auth: this.authManager.getTokenStatus(),
      rateLimit: this.rateLimiter.getStatus(),
      requestStats: this.rateLimiter.getRequestStats()
    };
  }

  /**
   * 重置客户端状态
   */
  reset(): void {
    this.authManager.clearToken();
    this.rateLimiter.reset();
    this.logger.info('Reddit client reset');
  }

  /**
   * 获取用户代理
   */
  getUserAgent(): string {
    return this.authManager.getUserAgent();
  }

  /**
   * 更新配置
   */
  updateConfig(options: {
    userAgent?: string;
    maxRetries?: number;
    rateLimitOptions?: {
      minIntervalMs?: number;
      maxRequestsPerMinute?: number;
      maxRequestsPerHour?: number;
    };
  }): void {
    if (options.userAgent) {
      this.authManager.setUserAgent(options.userAgent);
    }

    if (options.maxRetries !== undefined) {
      this.maxRetries = options.maxRetries;
    }

    if (options.rateLimitOptions) {
      this.rateLimiter.adjustLimits(options.rateLimitOptions);
    }

    this.logger.info('Reddit client configuration updated', options);
  }
}