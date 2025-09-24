import { CollectionStats } from '../../../types';
import { getCurrentDateString, getUTCTimestamp } from '../../../utils/helpers';

/**
 * 采集统计数据模型
 * 负责统计信息的创建、更新和计算
 */
export class CollectionStatsModel {
  /**
   * 创建新的采集统计记录
   */
  static create(
    batchId: string,
    subreddit: string,
    startTime: number = getUTCTimestamp()
  ): Omit<CollectionStats, 'id' | 'created_at'> {
    return {
      collection_date: getCurrentDateString(),
      collection_batch_id: batchId,
      subreddit,
      total_fetched: 0,
      total_filtered: 0,
      total_saved: 0,
      start_time: startTime,
      end_time: null,
      duration_seconds: null,
      status: 'running',
      error_message: null
    };
  }

  /**
   * 更新统计记录为完成状态
   */
  static complete(
    stats: Omit<CollectionStats, 'id' | 'created_at'>,
    totalFetched: number,
    totalFiltered: number,
    totalSaved: number,
    endTime: number = getUTCTimestamp()
  ): Omit<CollectionStats, 'id' | 'created_at'> {
    const durationSeconds = endTime - stats.start_time;

    return {
      ...stats,
      total_fetched: totalFetched,
      total_filtered: totalFiltered,
      total_saved: totalSaved,
      end_time: endTime,
      duration_seconds: durationSeconds,
      status: 'completed'
    };
  }

  /**
   * 更新统计记录为失败状态
   */
  static fail(
    stats: Omit<CollectionStats, 'id' | 'created_at'>,
    errorMessage: string,
    endTime: number = getUTCTimestamp()
  ): Omit<CollectionStats, 'id' | 'created_at'> {
    const durationSeconds = endTime - stats.start_time;

    return {
      ...stats,
      end_time: endTime,
      duration_seconds: durationSeconds,
      status: 'failed',
      error_message: errorMessage
    };
  }

  /**
   * 计算采集效率指标
   */
  static calculateEfficiency(stats: CollectionStats): {
    filterRate: number;      // 过滤率 (%)
    saveRate: number;        // 保存率 (%)
    postsPerSecond: number;  // 每秒处理帖子数
    successRate: number;     // 成功率 (%)
  } {
    const filterRate = stats.total_fetched > 0 
      ? Math.round((stats.total_filtered / stats.total_fetched) * 100)
      : 0;

    const saveRate = stats.total_filtered > 0 
      ? Math.round((stats.total_saved / stats.total_filtered) * 100)
      : 0;

    const postsPerSecond = stats.duration_seconds && stats.duration_seconds > 0
      ? Math.round((stats.total_fetched / stats.duration_seconds) * 100) / 100
      : 0;

    const successRate = stats.status === 'completed' ? 100 : 0;

    return {
      filterRate,
      saveRate,
      postsPerSecond,
      successRate
    };
  }

  /**
   * 获取统计摘要
   */
  static getSummary(stats: CollectionStats): {
    batchId: string;
    subreddit: string;
    status: string;
    duration: string;
    fetched: number;
    saved: number;
    efficiency: string;
    error?: string;
  } {
    const efficiency = this.calculateEfficiency(stats);
    
    let durationText = 'N/A';
    if (stats.duration_seconds) {
      const minutes = Math.floor(stats.duration_seconds / 60);
      const seconds = stats.duration_seconds % 60;
      durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    }

    return {
      batchId: stats.collection_batch_id,
      subreddit: stats.subreddit,
      status: stats.status,
      duration: durationText,
      fetched: stats.total_fetched,
      saved: stats.total_saved,
      efficiency: `${efficiency.saveRate}%`,
      error: stats.error_message || undefined
    };
  }

  /**
   * 验证统计数据
   */
  static validate(stats: Partial<CollectionStats>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!stats.collection_batch_id || typeof stats.collection_batch_id !== 'string') {
      errors.push('Invalid collection_batch_id');
    }

    if (!stats.subreddit || typeof stats.subreddit !== 'string') {
      errors.push('Invalid subreddit');
    }

    if (!stats.collection_date || typeof stats.collection_date !== 'string') {
      errors.push('Invalid collection_date');
    }

    if (typeof stats.total_fetched !== 'number' || stats.total_fetched < 0) {
      errors.push('Invalid total_fetched');
    }

    if (typeof stats.total_filtered !== 'number' || stats.total_filtered < 0) {
      errors.push('Invalid total_filtered');
    }

    if (typeof stats.total_saved !== 'number' || stats.total_saved < 0) {
      errors.push('Invalid total_saved');
    }

    if (typeof stats.start_time !== 'number' || stats.start_time <= 0) {
      errors.push('Invalid start_time');
    }

    // 逻辑验证
    if (stats.total_filtered && stats.total_fetched && 
        stats.total_filtered > stats.total_fetched) {
      errors.push('total_filtered cannot be greater than total_fetched');
    }

    if (stats.total_saved && stats.total_filtered && 
        stats.total_saved > stats.total_filtered) {
      errors.push('total_saved cannot be greater than total_filtered');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 合并多个统计记录（用于批次汇总）
   */
  static merge(statsList: CollectionStats[], batchId: string): Omit<CollectionStats, 'id' | 'created_at'> {
    if (statsList.length === 0) {
      throw new Error('Cannot merge empty stats list');
    }

    const firstStats = statsList[0];
    const earliestStartTime = Math.min(...statsList.map(s => s.start_time));
    const latestEndTime = Math.max(...statsList.map(s => s.end_time || s.start_time));
    
    const totalFetched = statsList.reduce((sum, s) => sum + s.total_fetched, 0);
    const totalFiltered = statsList.reduce((sum, s) => sum + s.total_filtered, 0);
    const totalSaved = statsList.reduce((sum, s) => sum + s.total_saved, 0);

    const hasFailures = statsList.some(s => s.status === 'failed');
    const allCompleted = statsList.every(s => s.status === 'completed');

    let status: string;
    let errorMessage: string | null = null;

    if (hasFailures) {
      status = 'partial';
      const failedSubreddits = statsList
        .filter(s => s.status === 'failed')
        .map(s => s.subreddit);
      errorMessage = `Failed subreddits: ${failedSubreddits.join(', ')}`;
    } else if (allCompleted) {
      status = 'completed';
    } else {
      status = 'running';
    }

    return {
      collection_date: firstStats.collection_date,
      collection_batch_id: batchId,
      subreddit: 'ALL', // 表示合并统计
      total_fetched: totalFetched,
      total_filtered: totalFiltered,
      total_saved: totalSaved,
      start_time: earliestStartTime,
      end_time: latestEndTime,
      duration_seconds: latestEndTime - earliestStartTime,
      status,
      error_message: errorMessage
    };
  }

  /**
   * 生成日报告
   */
  static generateDailyReport(statsList: CollectionStats[]): {
    date: string;
    totalBatches: number;
    totalSubreddits: number;
    totalFetched: number;
    totalSaved: number;
    successfulBatches: number;
    failedBatches: number;
    averageDuration: number;
    topSubreddits: Array<{ subreddit: string; saved: number }>;
    efficiency: {
      overallSaveRate: number;
      averagePostsPerSecond: number;
    };
  } {
    if (statsList.length === 0) {
      throw new Error('Cannot generate report for empty stats list');
    }

    const date = statsList[0].collection_date;
    const totalBatches = statsList.length;
    const uniqueSubreddits = new Set(statsList.map(s => s.subreddit)).size;
    
    const totalFetched = statsList.reduce((sum, s) => sum + s.total_fetched, 0);
    const totalSaved = statsList.reduce((sum, s) => sum + s.total_saved, 0);
    
    const successfulBatches = statsList.filter(s => s.status === 'completed').length;
    const failedBatches = statsList.filter(s => s.status === 'failed').length;
    
    const validDurations = statsList
      .filter(s => s.duration_seconds && s.duration_seconds > 0)
      .map(s => s.duration_seconds!);
    const averageDuration = validDurations.length > 0
      ? Math.round(validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length)
      : 0;

    // 按保存数量排序的社区
    const topSubreddits = statsList
      .filter(s => s.subreddit !== 'ALL')
      .sort((a, b) => b.total_saved - a.total_saved)
      .slice(0, 10)
      .map(s => ({ subreddit: s.subreddit, saved: s.total_saved }));

    // 效率指标
    const overallSaveRate = totalFetched > 0 
      ? Math.round((totalSaved / totalFetched) * 100)
      : 0;

    const totalProcessingTime = validDurations.reduce((sum, d) => sum + d, 0);
    const averagePostsPerSecond = totalProcessingTime > 0
      ? Math.round((totalFetched / totalProcessingTime) * 100) / 100
      : 0;

    return {
      date,
      totalBatches,
      totalSubreddits: uniqueSubreddits,
      totalFetched,
      totalSaved,
      successfulBatches,
      failedBatches,
      averageDuration,
      topSubreddits,
      efficiency: {
        overallSaveRate,
        averagePostsPerSecond
      }
    };
  }
}
