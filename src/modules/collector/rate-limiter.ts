import { Logger } from '../../types';
import { sleep } from '../../utils/helpers';

/**
 * Reddit API频率限制器
 * 管理API调用频率，遵守Reddit的限制政策
 */
export class RedditRateLimiter {
  private logger: Logger;
  private requestHistory: number[] = [];
  private lastRequestTime: number = 0;
  private minInterval: number; // 最小请求间隔（毫秒）
  private maxRequestsPerMinute: number;
  private maxRequestsPerHour: number;
  private currentMinuteRequests: number = 0;
  private currentHourRequests: number = 0;
  private minuteResetTime: number = 0;
  private hourResetTime: number = 0;

  constructor(
    logger: Logger,
    options: {
      minIntervalMs?: number;
      maxRequestsPerMinute?: number;
      maxRequestsPerHour?: number;
    } = {}
  ) {
    this.logger = logger.child('RateLimit');
    this.minInterval = options.minIntervalMs || 1000; // 默认1秒间隔
    this.maxRequestsPerMinute = options.maxRequestsPerMinute || 60;
    this.maxRequestsPerHour = options.maxRequestsPerHour || 3600;
    
    this.resetCounters();
  }

  /**
   * 重置计数器
   */
  private resetCounters(): void {
    const now = Date.now();
    this.minuteResetTime = now + 60000; // 1分钟后重置
    this.hourResetTime = now + 3600000; // 1小时后重置
  }

  /**
   * 检查并更新计数器
   */
  private updateCounters(): void {
    const now = Date.now();

    // 检查是否需要重置分钟计数器
    if (now >= this.minuteResetTime) {
      this.currentMinuteRequests = 0;
      this.minuteResetTime = now + 60000;
      this.logger.debug('Minute counter reset');
    }

    // 检查是否需要重置小时计数器
    if (now >= this.hourResetTime) {
      this.currentHourRequests = 0;
      this.hourResetTime = now + 3600000;
      this.logger.debug('Hour counter reset');
    }
  }

  /**
   * 等待直到可以发送请求
   */
  async waitForRequest(): Promise<void> {
    this.updateCounters();

    // 检查小时限制
    if (this.currentHourRequests >= this.maxRequestsPerHour) {
      const waitTime = this.hourResetTime - Date.now();
      this.logger.warn('Hour rate limit reached, waiting', { 
        waitTimeMs: waitTime,
        currentRequests: this.currentHourRequests,
        maxRequests: this.maxRequestsPerHour
      });
      
      if (waitTime > 0) {
        await sleep(waitTime);
        this.updateCounters();
      }
    }

    // 检查分钟限制
    if (this.currentMinuteRequests >= this.maxRequestsPerMinute) {
      const waitTime = this.minuteResetTime - Date.now();
      this.logger.warn('Minute rate limit reached, waiting', { 
        waitTimeMs: waitTime,
        currentRequests: this.currentMinuteRequests,
        maxRequests: this.maxRequestsPerMinute
      });
      
      if (waitTime > 0) {
        await sleep(waitTime);
        this.updateCounters();
      }
    }

    // 检查最小间隔
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      this.logger.debug('Waiting for minimum interval', { 
        waitTimeMs: waitTime,
        minInterval: this.minInterval
      });
      await sleep(waitTime);
    }

    // 更新请求时间和计数
    this.lastRequestTime = Date.now();
    this.currentMinuteRequests++;
    this.currentHourRequests++;
    
    // 保持请求历史（最近1小时）
    this.requestHistory.push(this.lastRequestTime);
    const oneHourAgo = this.lastRequestTime - 3600000;
    this.requestHistory = this.requestHistory.filter(time => time > oneHourAgo);
  }

  /**
   * 处理API响应中的速率限制信息
   */
  handleRateLimitHeaders(headers: Headers): void {
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    const used = headers.get('x-ratelimit-used');

    if (remaining || reset || used) {
      this.logger.debug('Rate limit headers received', {
        remaining: remaining ? parseInt(remaining) : null,
        reset: reset ? parseInt(reset) : null,
        used: used ? parseInt(used) : null
      });

      // 如果剩余请求数很少，调整间隔
      if (remaining && parseInt(remaining) < 10) {
        this.logger.warn('Low remaining requests, increasing interval', {
          remaining: parseInt(remaining)
        });
        this.minInterval = Math.max(this.minInterval, 2000); // 增加到至少2秒
      }
    }
  }

  /**
   * 处理429错误（请求过多）
   */
  async handle429Error(response: Response): Promise<void> {
    const retryAfter = response.headers.get('retry-after');
    let waitTime = 60000; // 默认等待1分钟

    if (retryAfter) {
      const retrySeconds = parseInt(retryAfter);
      if (!isNaN(retrySeconds)) {
        waitTime = retrySeconds * 1000;
      }
    }

    this.logger.warn('Rate limit exceeded (429), waiting', {
      waitTimeMs: waitTime,
      retryAfter
    });

    // 临时增加最小间隔
    this.minInterval = Math.max(this.minInterval * 2, 5000);

    await sleep(waitTime);
  }

  /**
   * 获取当前速率限制状态
   */
  getStatus(): {
    currentMinuteRequests: number;
    currentHourRequests: number;
    maxRequestsPerMinute: number;
    maxRequestsPerHour: number;
    minInterval: number;
    timeSinceLastRequest: number;
    timeToMinuteReset: number;
    timeToHourReset: number;
    recentRequestsCount: number;
  } {
    const now = Date.now();
    
    return {
      currentMinuteRequests: this.currentMinuteRequests,
      currentHourRequests: this.currentHourRequests,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      maxRequestsPerHour: this.maxRequestsPerHour,
      minInterval: this.minInterval,
      timeSinceLastRequest: now - this.lastRequestTime,
      timeToMinuteReset: Math.max(0, this.minuteResetTime - now),
      timeToHourReset: Math.max(0, this.hourResetTime - now),
      recentRequestsCount: this.requestHistory.length
    };
  }

  /**
   * 预测下次可以请求的时间
   */
  getNextRequestTime(): number {
    this.updateCounters();
    
    let nextTime = this.lastRequestTime + this.minInterval;

    // 检查分钟限制
    if (this.currentMinuteRequests >= this.maxRequestsPerMinute) {
      nextTime = Math.max(nextTime, this.minuteResetTime);
    }

    // 检查小时限制
    if (this.currentHourRequests >= this.maxRequestsPerHour) {
      nextTime = Math.max(nextTime, this.hourResetTime);
    }

    return nextTime;
  }

  /**
   * 检查是否可以立即发送请求
   */
  canMakeRequest(): boolean {
    this.updateCounters();
    
    const now = Date.now();
    
    // 检查最小间隔
    if (now - this.lastRequestTime < this.minInterval) {
      return false;
    }

    // 检查分钟限制
    if (this.currentMinuteRequests >= this.maxRequestsPerMinute) {
      return false;
    }

    // 检查小时限制
    if (this.currentHourRequests >= this.maxRequestsPerHour) {
      return false;
    }

    return true;
  }

  /**
   * 调整速率限制参数
   */
  adjustLimits(options: {
    minIntervalMs?: number;
    maxRequestsPerMinute?: number;
    maxRequestsPerHour?: number;
  }): void {
    if (options.minIntervalMs !== undefined) {
      this.minInterval = options.minIntervalMs;
    }
    if (options.maxRequestsPerMinute !== undefined) {
      this.maxRequestsPerMinute = options.maxRequestsPerMinute;
    }
    if (options.maxRequestsPerHour !== undefined) {
      this.maxRequestsPerHour = options.maxRequestsPerHour;
    }

    this.logger.info('Rate limits adjusted', {
      minInterval: this.minInterval,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      maxRequestsPerHour: this.maxRequestsPerHour
    });
  }

  /**
   * 重置所有限制器状态
   */
  reset(): void {
    this.requestHistory = [];
    this.lastRequestTime = 0;
    this.currentMinuteRequests = 0;
    this.currentHourRequests = 0;
    this.resetCounters();
    this.logger.info('Rate limiter reset');
  }

  /**
   * 获取请求历史统计
   */
  getRequestStats(): {
    totalRequests: number;
    requestsInLastHour: number;
    requestsInLastMinute: number;
    averageInterval: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneMinuteAgo = now - 60000;

    const requestsInLastHour = this.requestHistory.filter(time => time > oneHourAgo).length;
    const requestsInLastMinute = this.requestHistory.filter(time => time > oneMinuteAgo).length;

    let averageInterval = 0;
    if (this.requestHistory.length > 1) {
      const intervals = [];
      for (let i = 1; i < this.requestHistory.length; i++) {
        intervals.push(this.requestHistory[i] - this.requestHistory[i - 1]);
      }
      averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    }

    return {
      totalRequests: this.requestHistory.length,
      requestsInLastHour,
      requestsInLastMinute,
      averageInterval
    };
  }
}
