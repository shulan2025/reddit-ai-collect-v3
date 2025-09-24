import { Logger, RedditPost } from '../../types';
import { QuotaManager } from './quota-manager';
import { BatchManager, BatchTask } from './batch-manager';
import { RedditClient } from '../collector/reddit-client';
import { PostProcessor } from '../processor/post-processor';
import { SimpleDatabaseManager } from '../storage/simple-database-manager';
import { generateBatchId, getCurrentDateString, getUTCTimestamp } from '../../utils/helpers';

/**
 * 社区配置接口
 */
interface SubredditConfig {
  name: string;
  priority: number;
  dailyQuota: number;
  minScore: number;
  minComments: number;
  minUpvoteRatio: number;
  maxPostsPerRequest: number;
  isActive: boolean;
}

/**
 * 采集调度器
 * 协调整个采集流程，包括配额分配、任务调度、数据处理和存储
 */
export class CollectionScheduler {
  private logger: Logger;
  private quotaManager: QuotaManager;
  private batchManager: BatchManager;
  private redditClient: RedditClient;
  private postProcessor: PostProcessor;
  private databaseManager: SimpleDatabaseManager;
  private isRunning: boolean = false;

  constructor(
    logger: Logger,
    redditClient: RedditClient,
    postProcessor: PostProcessor,
    databaseManager: SimpleDatabaseManager,
    options: {
      dailyLimit?: number;
      maxConcurrentBatches?: number;
    } = {}
  ) {
    this.logger = logger.child('CollectionScheduler');
    this.redditClient = redditClient;
    this.postProcessor = postProcessor;
    this.databaseManager = databaseManager;

    this.quotaManager = new QuotaManager(this.logger, options.dailyLimit || 2000);
    this.batchManager = new BatchManager(this.logger, {
      maxConcurrentBatches: options.maxConcurrentBatches || 3
    });

    this.logger.info('Collection scheduler initialized', {
      dailyLimit: options.dailyLimit || 2000,
      maxConcurrentBatches: options.maxConcurrentBatches || 3
    });
  }

  /**
   * 执行完整的采集流程
   */
  async executeCollection(
    subredditConfigs: SubredditConfig[],
    options: {
      enableAIDetection?: boolean;
      aiThreshold?: number;
      continueOnError?: boolean;
      timeout?: number;
    } = {}
  ): Promise<{
    batchId: string;
    status: 'completed' | 'partial' | 'failed';
    summary: {
      totalSubreddits: number;
      processedSubreddits: number;
      totalFetched: number;
      totalProcessed: number;
      totalSaved: number;
      duration: number;
    };
    subredditResults: Array<{
      subreddit: string;
      status: string;
      fetched: number;
      processed: number;
      saved: number;
      error?: string;
    }>;
    quotaUsage: any;
    errors: Array<{ subreddit: string; error: string }>;
  }> {
    if (this.isRunning) {
      throw new Error('Collection is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const batchId = generateBatchId();

    this.logger.info('Starting collection execution', {
      batchId,
      totalSubreddits: subredditConfigs.length,
      options
    });

    try {
      // 1. 验证系统状态
      await this.validateSystemStatus();

      // 2. 过滤活跃的社区配置
      const activeConfigs = subredditConfigs.filter(config => config.isActive);
      
      if (activeConfigs.length === 0) {
        throw new Error('No active subreddit configurations found');
      }

      // 3. 分配配额
      const quotaAllocations = this.quotaManager.allocateSubredditQuotas(
        activeConfigs.map(config => ({
          name: config.name,
          priority: config.priority,
          dailyQuota: config.dailyQuota
        }))
      );

      // 4. 创建批次任务
      const tasks = activeConfigs
        .filter(config => quotaAllocations.has(config.name))
        .map(config => ({
          subreddit: config.name,
          priority: config.priority,
          quota: quotaAllocations.get(config.name)!,
          maxPostsPerRequest: config.maxPostsPerRequest
        }));

      this.batchManager.createBatch(batchId, tasks);

      // 5. 执行批次
      const batchResult = await this.batchManager.executeBatch(
        batchId,
        (task) => this.executeSubredditTask(task, subredditConfigs, options),
        {
          timeout: options.timeout || 300000,
          continueOnError: options.continueOnError !== false
        }
      );

      // 6. 生成结果摘要
      const subredditResults = this.generateSubredditResults(batchId);
      const quotaUsage = this.quotaManager.getQuotaUsage();

      const summary = {
        totalSubreddits: activeConfigs.length,
        processedSubreddits: batchResult.completedTasks,
        totalFetched: batchResult.results.totalFetched,
        totalProcessed: batchResult.results.totalProcessed,
        totalSaved: batchResult.results.totalSaved,
        duration: Date.now() - startTime
      };

      this.logger.info('Collection execution completed', {
        batchId,
        status: batchResult.status,
        summary
      });

      return {
        batchId,
        status: batchResult.status,
        summary,
        subredditResults,
        quotaUsage,
        errors: batchResult.errors
      };

    } catch (error) {
      this.logger.error('Collection execution failed', {
        batchId,
        error: error.message,
        duration: Date.now() - startTime
      });

      return {
        batchId,
        status: 'failed',
        summary: {
          totalSubreddits: subredditConfigs.length,
          processedSubreddits: 0,
          totalFetched: 0,
          totalProcessed: 0,
          totalSaved: 0,
          duration: Date.now() - startTime
        },
        subredditResults: [],
        quotaUsage: this.quotaManager.getQuotaUsage(),
        errors: [{ subreddit: 'system', error: error.message }]
      };

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 执行单个社区的采集任务
   */
  private async executeSubredditTask(
    task: BatchTask,
    subredditConfigs: SubredditConfig[],
    options: {
      enableAIDetection?: boolean;
      aiThreshold?: number;
    }
  ): Promise<{
    fetched: number;
    processed: number;
    saved: number;
  }> {
    const config = subredditConfigs.find(c => c.name === task.subreddit);
    if (!config) {
      throw new Error(`Configuration not found for subreddit: ${task.subreddit}`);
    }

    this.logger.info('Starting subreddit task', {
      subreddit: task.subreddit,
      quota: task.quota,
      maxPostsPerRequest: task.maxPostsPerRequest
    });

    try {
      // 1. 从Reddit获取帖子
      const posts = await this.redditClient.getSubredditPosts(task.subreddit, {
        sort: 'hot',
        limit: Math.min(task.quota, task.maxPostsPerRequest),
        maxAgeHours: 720 // 30天
      });

      this.logger.info('Posts fetched from Reddit', {
        subreddit: task.subreddit,
        fetched: posts.length
      });

      if (posts.length === 0) {
        return { fetched: 0, processed: 0, saved: 0 };
      }

      // 2. 处理帖子（过滤 + AI检测）
      const processingResult = await this.postProcessor.processPosts(posts, {
        filterConfig: {
          minScore: config.minScore,
          minComments: config.minComments,
          minUpvoteRatio: config.minUpvoteRatio
        },
        enableAIDetection: options.enableAIDetection !== false,
        aiThreshold: options.aiThreshold || 2.0
      });

      this.logger.info('Posts processed', {
        subreddit: task.subreddit,
        original: posts.length,
        processed: processingResult.processed.length,
        filtered: processingResult.filtered.length
      });

      // 3. 保存到数据库
      let saved = 0;
      if (processingResult.processed.length > 0) {
        const saveResult = await this.databaseManager.savePosts(
          processingResult.processed,
          task.id
        );
        saved = saveResult.saved;

        this.logger.info('Posts saved to database', {
          subreddit: task.subreddit,
          saved: saveResult.saved,
          failed: saveResult.failed
        });
      }

      // 4. 更新配额使用
      this.quotaManager.useQuota(task.subreddit, saved);

      // 5. 保存采集统计
      await this.saveCollectionStats(task, {
        fetched: posts.length,
        processed: processingResult.processed.length,
        saved
      });

      return {
        fetched: posts.length,
        processed: processingResult.processed.length,
        saved
      };

    } catch (error) {
      this.logger.error('Subreddit task failed', {
        subreddit: task.subreddit,
        error: error.message
      });

      // 保存错误统计
      await this.saveCollectionStats(task, {
        fetched: 0,
        processed: 0,
        saved: 0
      }, error.message);

      throw error;
    }
  }

  /**
   * 保存采集统计信息
   */
  private async saveCollectionStats(
    task: BatchTask,
    result: { fetched: number; processed: number; saved: number },
    errorMessage?: string
  ): Promise<void> {
    try {
      const stats = {
        collection_date: getCurrentDateString(),
        collection_batch_id: task.id,
        subreddit: task.subreddit,
        total_fetched: result.fetched,
        total_filtered: result.processed,
        total_saved: result.saved,
        start_time: task.startedAt || task.createdAt,
        end_time: task.completedAt || getUTCTimestamp(),
        duration_seconds: (task.completedAt || getUTCTimestamp()) - (task.startedAt || task.createdAt),
        status: errorMessage ? 'failed' : 'completed',
        error_message: errorMessage || null
      };

      await this.databaseManager.saveCollectionStats(stats);

      // 如果有错误，也记录到错误日志
      if (errorMessage) {
        await this.databaseManager.logError({
          error_type: 'collection_task_failed',
          error_message: errorMessage,
          subreddit: task.subreddit,
          collection_batch_id: task.id,
          severity: 'error',
          resolved: false
        });
      }

    } catch (error) {
      this.logger.error('Failed to save collection stats', {
        taskId: task.id,
        error: error.message
      });
    }
  }

  /**
   * 验证系统状态
   */
  private async validateSystemStatus(): Promise<void> {
    this.logger.info('Validating system status');

    // 1. 检查Reddit API连接
    const redditValidation = await this.redditClient.validateConnection();
    if (!redditValidation.isValid) {
      throw new Error(`Reddit API validation failed: ${redditValidation.error}`);
    }

    // 2. 检查数据库连接
    const dbHealthy = await this.databaseManager.testConnection();
    if (!dbHealthy) {
      throw new Error('Database connection test failed');
    }

    // 3. 检查配额状态
    const quotaSummary = this.quotaManager.getQuotaSummary();
    if (quotaSummary.status === 'critical') {
      this.logger.warn('Quota status is critical', quotaSummary);
    }

    this.logger.info('System status validation completed', {
      reddit: 'healthy',
      database: 'healthy',
      quota: quotaSummary.status
    });
  }

  /**
   * 生成社区结果摘要
   */
  private generateSubredditResults(batchId: string): Array<{
    subreddit: string;
    status: string;
    fetched: number;
    processed: number;
    saved: number;
    error?: string;
  }> {
    const batchStatus = this.batchManager.getBatchStatus(batchId);
    if (!batchStatus) {
      return [];
    }

    return batchStatus.tasks.map(task => ({
      subreddit: task.subreddit,
      status: task.status,
      fetched: task.result?.fetched || 0,
      processed: task.result?.processed || 0,
      saved: task.result?.saved || 0,
      error: task.error
    }));
  }

  /**
   * 获取调度器状态
   */
  getSchedulerStatus(): {
    isRunning: boolean;
    quotaStatus: any;
    batchManagerStats: any;
    redditClientStatus: any;
    databaseHealth: any;
  } {
    return {
      isRunning: this.isRunning,
      quotaStatus: this.quotaManager.getQuotaSummary(),
      batchManagerStats: this.batchManager.getManagerStats(),
      redditClientStatus: this.redditClient.getStatus(),
      databaseHealth: 'Available' // SimpleDatabaseManager没有详细状态方法
    };
  }

  /**
   * 停止当前采集
   */
  async stopCollection(): Promise<boolean> {
    if (!this.isRunning) {
      this.logger.warn('No collection is currently running');
      return false;
    }

    this.logger.info('Stopping collection');

    // 取消所有活跃的批次
    const allBatches = this.batchManager.getAllBatchesStatus();
    const activeBatches = allBatches.filter(batch => batch?.isActive);

    for (const batch of activeBatches) {
      if (batch) {
        this.batchManager.cancelBatch(batch.batchId);
      }
    }

    this.isRunning = false;
    this.logger.info('Collection stopped');

    return true;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up scheduler resources');

    // 停止任何正在运行的采集
    await this.stopCollection();

    // 清理完成的批次
    const cleanedBatches = this.batchManager.cleanupCompletedBatches(1); // 1小时前的批次

    this.logger.info('Scheduler cleanup completed', {
      cleanedBatches
    });
  }

  /**
   * 生成采集报告
   */
  generateCollectionReport(batchId: string): string | null {
    const batchReport = this.batchManager.generateBatchReport(batchId);
    if (!batchReport) {
      return null;
    }

    const quotaUsage = this.quotaManager.getQuotaUsage();
    const schedulerStatus = this.getSchedulerStatus();

    const report = [
      batchReport,
      '',
      'Quota Usage:',
      `Total Used: ${quotaUsage.totalUsed}/${quotaUsage.totalLimit} (${quotaUsage.usagePercentage}%)`,
      `Remaining: ${quotaUsage.totalRemaining}`,
      '',
      'System Status:',
      `Scheduler Running: ${schedulerStatus.isRunning}`,
      `Quota Status: ${schedulerStatus.quotaStatus.status}`,
      `Active Batches: ${schedulerStatus.batchManagerStats.activeBatches}`
    ].join('\n');

    return report;
  }
}
