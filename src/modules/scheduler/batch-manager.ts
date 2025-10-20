import { Logger } from '../../types';
import { generateBatchId, getCurrentDateString, getUTCTimestamp, sleep } from '../../utils/helpers';

/**
 * 批次执行状态
 */
export type BatchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 批次任务接口
 */
export interface BatchTask {
  id: string;
  subreddit: string;
  priority: number;
  quota: number;
  maxPostsPerRequest: number;
  status: BatchStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: {
    fetched: number;
    processed: number;
    saved: number;
  };
}

/**
 * 批次管理器
 * 负责管理采集任务的批次执行、调度和监控
 */
export class BatchManager {
  private logger: Logger;
  private batches: Map<string, BatchTask[]> = new Map();
  private activeBatches: Set<string> = new Set();
  private maxConcurrentBatches: number;
  private defaultTimeout: number;

  constructor(
    logger: Logger, 
    options: {
      maxConcurrentBatches?: number;
      defaultTimeoutMs?: number;
    } = {}
  ) {
    this.logger = logger.child('BatchManager');
    this.maxConcurrentBatches = options.maxConcurrentBatches || 3;
    this.defaultTimeout = options.defaultTimeoutMs || 300000; // 5分钟

    this.logger.info('Batch manager initialized', {
      maxConcurrentBatches: this.maxConcurrentBatches,
      defaultTimeoutMs: this.defaultTimeout
    });
  }

  /**
   * 创建新的批次
   */
  createBatch(
    batchId: string,
    tasks: Array<{
      subreddit: string;
      priority: number;
      quota: number;
      maxPostsPerRequest: number;
    }>
  ): string {
    const now = getUTCTimestamp();
    
    const batchTasks: BatchTask[] = tasks.map(task => ({
      id: `${batchId}_${task.subreddit}`,
      subreddit: task.subreddit,
      priority: task.priority,
      quota: task.quota,
      maxPostsPerRequest: task.maxPostsPerRequest,
      status: 'pending',
      createdAt: now
    }));

    // 按优先级排序
    batchTasks.sort((a, b) => a.priority - b.priority);

    this.batches.set(batchId, batchTasks);

    this.logger.info('Batch created', {
      batchId,
      taskCount: batchTasks.length,
      subreddits: batchTasks.map(t => t.subreddit)
    });

    return batchId;
  }

  /**
   * 执行批次
   */
  async executeBatch<T>(
    batchId: string,
    taskExecutor: (task: BatchTask) => Promise<{
      fetched: number;
      processed: number;
      saved: number;
    }>,
    options: {
      timeout?: number;
      continueOnError?: boolean;
      maxRetries?: number;
    } = {}
  ): Promise<{
    batchId: string;
    status: 'completed' | 'partial' | 'failed';
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    results: {
      totalFetched: number;
      totalProcessed: number;
      totalSaved: number;
    };
    duration: number;
    errors: Array<{ taskId: string; error: string }>;
  }> {
    const startTime = Date.now();
    const { 
      timeout = this.defaultTimeout, 
      continueOnError = true, 
      maxRetries = 2 
    } = options;

    const tasks = this.batches.get(batchId);
    if (!tasks) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    if (this.activeBatches.has(batchId)) {
      throw new Error(`Batch already running: ${batchId}`);
    }

    this.activeBatches.add(batchId);

    this.logger.info('Starting batch execution', {
      batchId,
      taskCount: tasks.length,
      timeout,
      continueOnError,
      maxRetries
    });

    let completedTasks = 0;
    let failedTasks = 0;
    const results = {
      totalFetched: 0,
      totalProcessed: 0,
      totalSaved: 0
    };
    const errors: Array<{ taskId: string; error: string }> = [];

    try {
      // 执行任务（顺序执行以遵守API限制）
      for (const task of tasks) {
        if (!this.activeBatches.has(batchId)) {
          this.logger.warn('Batch execution cancelled', { batchId });
          break;
        }

        try {
          task.status = 'running';
          task.startedAt = getUTCTimestamp();

          this.logger.debug('Starting task', {
            batchId,
            taskId: task.id,
            subreddit: task.subreddit
          });

          // 执行任务（带超时）
          const taskResult = await this.executeTaskWithTimeout(
            task,
            taskExecutor,
            timeout
          );

          task.result = taskResult;
          task.status = 'completed';
          task.completedAt = getUTCTimestamp();

          results.totalFetched += taskResult.fetched;
          results.totalProcessed += taskResult.processed;
          results.totalSaved += taskResult.saved;
          completedTasks++;

          this.logger.info('Task completed', {
            batchId,
            taskId: task.id,
            subreddit: task.subreddit,
            result: taskResult
          });

        } catch (error) {
          task.status = 'failed';
          task.error = error.message;
          task.completedAt = getUTCTimestamp();
          failedTasks++;

          const errorInfo = { taskId: task.id, error: error.message };
          errors.push(errorInfo);

          this.logger.error('Task failed', {
            batchId,
            taskId: task.id,
            subreddit: task.subreddit,
            error: error.message
          });

          if (!continueOnError) {
            this.logger.warn('Stopping batch execution due to task failure', { batchId });
            break;
          }
        }
      }

    } finally {
      this.activeBatches.delete(batchId);
    }

    const duration = Date.now() - startTime;
    let batchStatus: 'completed' | 'partial' | 'failed';

    if (failedTasks === 0) {
      batchStatus = 'completed';
    } else if (completedTasks > 0) {
      batchStatus = 'partial';
    } else {
      batchStatus = 'failed';
    }

    const executionResult = {
      batchId,
      status: batchStatus,
      totalTasks: tasks.length,
      completedTasks,
      failedTasks,
      results,
      duration,
      errors
    };

    this.logger.info('Batch execution completed', {
      ...executionResult,
      durationSeconds: Math.round(duration / 1000)
    });

    return executionResult;
  }

  /**
   * 带超时的任务执行
   */
  private async executeTaskWithTimeout<T>(
    task: BatchTask,
    taskExecutor: (task: BatchTask) => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task timeout after ${timeout}ms`));
      }, timeout);

      taskExecutor(task)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 取消批次执行
   */
  cancelBatch(batchId: string): boolean {
    if (!this.activeBatches.has(batchId)) {
      this.logger.warn('Batch not active, cannot cancel', { batchId });
      return false;
    }

    const tasks = this.batches.get(batchId);
    if (tasks) {
      // 将待执行的任务标记为已取消
      tasks
        .filter(task => task.status === 'pending')
        .forEach(task => {
          task.status = 'cancelled';
          task.completedAt = getUTCTimestamp();
        });
    }

    this.activeBatches.delete(batchId);

    this.logger.info('Batch cancelled', { batchId });
    return true;
  }

  /**
   * 获取批次状态
   */
  getBatchStatus(batchId: string): {
    batchId: string;
    isActive: boolean;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    pendingTasks: number;
    runningTasks: number;
    tasks: BatchTask[];
  } | null {
    const tasks = this.batches.get(batchId);
    if (!tasks) {
      return null;
    }

    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const failedTasks = tasks.filter(t => t.status === 'failed').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const runningTasks = tasks.filter(t => t.status === 'running').length;

    return {
      batchId,
      isActive: this.activeBatches.has(batchId),
      totalTasks: tasks.length,
      completedTasks,
      failedTasks,
      pendingTasks,
      runningTasks,
      tasks: [...tasks] // 返回副本
    };
  }

  /**
   * 获取所有批次状态
   */
  getAllBatchesStatus(): Array<ReturnType<BatchManager['getBatchStatus']>> {
    const statuses: Array<ReturnType<BatchManager['getBatchStatus']>> = [];
    
    for (const batchId of this.batches.keys()) {
      const status = this.getBatchStatus(batchId);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses;
  }

  /**
   * 清理完成的批次
   */
  cleanupCompletedBatches(olderThanHours: number = 24): number {
    const cutoffTime = getUTCTimestamp() - (olderThanHours * 3600);
    let cleanedCount = 0;

    for (const [batchId, tasks] of this.batches.entries()) {
      // 跳过活跃的批次
      if (this.activeBatches.has(batchId)) {
        continue;
      }

      // 检查是否所有任务都已完成且超过指定时间
      const allTasksCompleted = tasks.every(task => 
        ['completed', 'failed', 'cancelled'].includes(task.status)
      );

      const oldestCompletionTime = Math.min(
        ...tasks
          .filter(task => task.completedAt)
          .map(task => task.completedAt!)
      );

      if (allTasksCompleted && oldestCompletionTime < cutoffTime) {
        this.batches.delete(batchId);
        cleanedCount++;

        this.logger.debug('Cleaned up completed batch', {
          batchId,
          taskCount: tasks.length,
          completedAt: oldestCompletionTime
        });
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Batch cleanup completed', {
        cleanedBatches: cleanedCount,
        remainingBatches: this.batches.size
      });
    }

    return cleanedCount;
  }

  /**
   * 获取批次性能统计
   */
  getBatchPerformanceStats(batchId: string): {
    averageTaskDuration: number;
    totalDuration: number;
    throughputPerMinute: number;
    successRate: number;
    errorRate: number;
  } | null {
    const tasks = this.batches.get(batchId);
    if (!tasks) {
      return null;
    }

    const completedTasks = tasks.filter(task => 
      task.status === 'completed' && task.startedAt && task.completedAt
    );

    if (completedTasks.length === 0) {
      return {
        averageTaskDuration: 0,
        totalDuration: 0,
        throughputPerMinute: 0,
        successRate: 0,
        errorRate: 0
      };
    }

    const taskDurations = completedTasks.map(task => 
      task.completedAt! - task.startedAt!
    );

    const averageTaskDuration = taskDurations.reduce((sum, duration) => sum + duration, 0) / taskDurations.length;
    
    const earliestStart = Math.min(...tasks.map(task => task.startedAt || task.createdAt));
    const latestCompletion = Math.max(...tasks.map(task => task.completedAt || task.createdAt));
    const totalDuration = latestCompletion - earliestStart;

    const throughputPerMinute = totalDuration > 0 
      ? (completedTasks.length / (totalDuration / 60))
      : 0;

    const successRate = (completedTasks.length / tasks.length) * 100;
    const errorRate = (tasks.filter(task => task.status === 'failed').length / tasks.length) * 100;

    return {
      averageTaskDuration,
      totalDuration,
      throughputPerMinute,
      successRate: Math.round(successRate),
      errorRate: Math.round(errorRate)
    };
  }

  /**
   * 生成批次报告
   */
  generateBatchReport(batchId: string): string | null {
    const status = this.getBatchStatus(batchId);
    const performance = this.getBatchPerformanceStats(batchId);
    
    if (!status || !performance) {
      return null;
    }

    const report = [
      `Batch Report: ${batchId}`,
      `================`,
      `Status: ${status.isActive ? 'Active' : 'Inactive'}`,
      `Total Tasks: ${status.totalTasks}`,
      `Completed: ${status.completedTasks}`,
      `Failed: ${status.failedTasks}`,
      `Success Rate: ${performance.successRate}%`,
      `Average Task Duration: ${Math.round(performance.averageTaskDuration)}s`,
      `Total Duration: ${Math.round(performance.totalDuration / 60)}m`,
      ``,
      `Task Details:`,
      ...status.tasks.map(task => 
        `- ${task.subreddit}: ${task.status} (${task.result ? `${task.result.saved} saved` : 'no result'})`
      )
    ].join('\n');

    return report;
  }

  /**
   * 获取管理器统计信息
   */
  getManagerStats(): {
    totalBatches: number;
    activeBatches: number;
    completedBatches: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
  } {
    const allStatuses = this.getAllBatchesStatus();
    
    const activeBatches = allStatuses.filter(s => s?.isActive).length;
    const completedBatches = allStatuses.filter(s => 
      s && !s.isActive && s.completedTasks === s.totalTasks
    ).length;

    const totalTasks = allStatuses.reduce((sum, s) => sum + (s?.totalTasks || 0), 0);
    const completedTasks = allStatuses.reduce((sum, s) => sum + (s?.completedTasks || 0), 0);
    const failedTasks = allStatuses.reduce((sum, s) => sum + (s?.failedTasks || 0), 0);

    return {
      totalBatches: this.batches.size,
      activeBatches,
      completedBatches,
      totalTasks,
      completedTasks,
      failedTasks
    };
  }
}
