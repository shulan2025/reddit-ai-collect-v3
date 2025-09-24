/**
 * 生成批次ID
 */
export function generateBatchId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `batch_${timestamp}_${random}`;
}

/**
 * 获取当前日期字符串 (YYYY-MM-DD)
 */
export function getCurrentDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 获取UTC时间戳
 */
export function getUTCTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 格式化时间戳为可读字符串
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * 计算时间差（秒）
 */
export function getTimeDifference(startTimestamp: number, endTimestamp: number): number {
  return endTimestamp - startTimestamp;
}

/**
 * 延迟函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 安全的JSON解析
 */
export function safeJSONParse<T>(jsonString: string | null, defaultValue: T): T {
  if (!jsonString) {
    return defaultValue;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn('JSON解析失败', { jsonString, error });
    return defaultValue;
  }
}

/**
 * 安全的JSON字符串化
 */
export function safeJSONStringify(obj: any): string | null {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.warn('JSON字符串化失败', { obj, error });
    return null;
  }
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * 清理HTML标签
 */
export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * 验证URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 计算数组平均值
 */
export function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, num) => acc + num, 0);
  return sum / numbers.length;
}

/**
 * 计算百分比
 */
export function calculatePercentage(part: number, total: number): number {
  if (total === 0) return 0;
  return (part / total) * 100;
}

/**
 * 格式化数字
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

/**
 * 格式化文件大小
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 格式化持续时间
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}

/**
 * 生成随机字符串
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }

  return obj;
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i === maxRetries) {
        throw lastError;
      }

      console.warn(`重试 ${i + 1}/${maxRetries} 失败:`, error);
      await sleep(delay * Math.pow(2, i)); // 指数退避
    }
  }

  throw lastError!;
}

/**
 * 批处理函数
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>,
  delay: number = 0
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
    
    if (delay > 0 && i + batchSize < items.length) {
      await sleep(delay);
    }
  }
  
  return results;
}

/**
 * 限制并发数
 */
export async function limitConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = processor(item).then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * 检查帖子是否在指定时间范围内
 */
export function isPostWithinTimeRange(postCreatedUTC: number, maxAgeHours: number): boolean {
  const now = getUTCTimestamp();
  const maxAgeSeconds = maxAgeHours * 3600;
  return (now - postCreatedUTC) <= maxAgeSeconds;
}

/**
 * 验证Reddit帖子ID格式
 */
export function isValidRedditPostId(id: string): boolean {
  // Reddit帖子ID通常是6-7个字符的字母数字组合
  return /^[a-z0-9]{6,7}$/i.test(id);
}

/**
 * 清理文本内容
 */
export function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\r\n/g, '\n')        // 统一换行符
    .replace(/\r/g, '\n')          // 统一换行符
    .replace(/\n{3,}/g, '\n\n')    // 限制连续换行
    .trim();                       // 去除首尾空白
}

/**
 * 计算文本的基础质量分数
 */
export function calculateTextQuality(title: string, selftext?: string): number {
  let score = 0;
  
  // 标题长度评分
  if (title.length >= 20) score += 1;
  if (title.length >= 50) score += 1;
  
  // 正文长度评分
  if (selftext) {
    if (selftext.length >= 100) score += 1;
    if (selftext.length >= 500) score += 1;
    if (selftext.length >= 1000) score += 1;
  }
  
  // 标点符号评分（表示结构化内容）
  const punctuationCount = (title + (selftext || '')).match(/[.!?]/g)?.length || 0;
  if (punctuationCount >= 3) score += 1;
  
  return score;
}

/**
 * 安全地获取嵌套对象属性
 */
export function safeGet<T>(obj: any, path: string, defaultValue?: T): T {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return defaultValue as T;
    }
    result = result[key];
  }
  
  return result !== undefined ? result : defaultValue as T;
}

/**
 * 获取指定天数前的日期字符串
 */
export function getDateStringDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * 将Reddit时间戳转换为UTC时间戳
 */
export function redditTimeToUTC(redditTime: number): number {
  // Reddit API返回的是UTC时间戳，但可能需要验证
  return Math.floor(redditTime);
}

/**
 * 批次处理数组
 */
export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  
  return batches;
}
