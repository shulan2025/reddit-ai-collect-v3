import { Logger as ILogger, LogLevel } from '../types';

export class Logger implements ILogger {
  private level: LogLevel;
  private context: string;
  private startTime: number;

  constructor(level: LogLevel = 'info', context: string = 'RedditCrawler') {
    this.level = level;
    this.context = context;
    this.startTime = Date.now();
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const elapsed = Date.now() - this.startTime;
    const metaStr = meta ? ` ${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] [+${elapsed}ms] ${message}${metaStr}`;
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setContext(context: string): void {
    this.context = context;
  }

  /**
   * 记录性能指标
   */
  performance(operation: string, duration: number, meta?: any): void {
    this.info(`Performance: ${operation} took ${duration}ms`, meta);
  }

  /**
   * 记录API调用
   */
  apiCall(method: string, url: string, statusCode?: number, duration?: number): void {
    const meta = { method, url, statusCode, duration };
    if (statusCode && statusCode >= 400) {
      this.warn(`API call failed: ${method} ${url}`, meta);
    } else {
      this.debug(`API call: ${method} ${url}`, meta);
    }
  }

  /**
   * 记录数据库操作
   */
  database(operation: string, table?: string, count?: number, duration?: number): void {
    const meta = { operation, table, count, duration };
    this.debug(`Database: ${operation}`, meta);
  }

  /**
   * 记录批次操作
   */
  batch(batchId: string, operation: string, count: number, meta?: any): void {
    this.info(`Batch ${batchId}: ${operation} (${count} items)`, meta);
  }

  /**
   * 创建子Logger
   */
  child(context: string): Logger {
    return new Logger(this.level, `${this.context}:${context}`);
  }

  /**
   * 记录数据库操作
   */
  database(operation: string, table?: string, count?: number, duration?: number): void {
    const meta = { operation, table, count, duration };
    this.debug(`Database: ${operation}`, meta);
  }

  /**
   * 重置计时器
   */
  resetTimer(): void {
    this.startTime = Date.now();
  }

  /**
   * 获取经过的时间
   */
  getElapsed(): number {
    return Date.now() - this.startTime;
  }
}
