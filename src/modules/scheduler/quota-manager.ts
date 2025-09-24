import { Logger } from '../../types';
import { getCurrentDateString } from '../../utils/helpers';

/**
 * 配额管理器
 * 负责管理每日采集配额、分配和跟踪
 */
export class QuotaManager {
  private logger: Logger;
  private dailyLimit: number;
  private currentDate: string;
  private usedQuota: number = 0;
  private subredditQuotas: Map<string, { allocated: number; used: number }> = new Map();

  constructor(logger: Logger, dailyLimit: number = 2000) {
    this.logger = logger.child('QuotaManager');
    this.dailyLimit = dailyLimit;
    this.currentDate = getCurrentDateString();
    
    this.logger.info('Quota manager initialized', {
      dailyLimit: this.dailyLimit,
      currentDate: this.currentDate
    });
  }

  /**
   * 分配社区配额
   */
  allocateSubredditQuotas(subredditConfigs: Array<{
    name: string;
    priority: number;
    dailyQuota: number;
  }>): Map<string, number> {
    this.resetIfNewDay();
    
    const allocations = new Map<string, number>();
    let totalAllocated = 0;

    // 按优先级排序
    const sortedConfigs = [...subredditConfigs].sort((a, b) => a.priority - b.priority);

    this.logger.info('Allocating subreddit quotas', {
      totalSubreddits: subredditConfigs.length,
      dailyLimit: this.dailyLimit
    });

    for (const config of sortedConfigs) {
      const remainingQuota = this.dailyLimit - totalAllocated;
      const allocatedQuota = Math.min(config.dailyQuota, remainingQuota);
      
      if (allocatedQuota > 0) {
        allocations.set(config.name, allocatedQuota);
        this.subredditQuotas.set(config.name, {
          allocated: allocatedQuota,
          used: 0
        });
        totalAllocated += allocatedQuota;

        this.logger.debug('Quota allocated', {
          subreddit: config.name,
          priority: config.priority,
          requested: config.dailyQuota,
          allocated: allocatedQuota
        });
      } else {
        this.logger.warn('No quota available for subreddit', {
          subreddit: config.name,
          requested: config.dailyQuota,
          remaining: remainingQuota
        });
      }
    }

    this.logger.info('Quota allocation completed', {
      totalAllocated,
      remainingQuota: this.dailyLimit - totalAllocated,
      allocatedSubreddits: allocations.size
    });

    return allocations;
  }

  /**
   * 检查是否可以使用配额
   */
  canUseQuota(subreddit: string, amount: number): boolean {
    this.resetIfNewDay();

    const subredditQuota = this.subredditQuotas.get(subreddit);
    if (!subredditQuota) {
      this.logger.warn('No quota allocated for subreddit', { subreddit });
      return false;
    }

    const available = subredditQuota.allocated - subredditQuota.used;
    const totalAvailable = this.dailyLimit - this.usedQuota;

    const canUse = available >= amount && totalAvailable >= amount;

    this.logger.debug('Quota check', {
      subreddit,
      requestAmount: amount,
      subredditAvailable: available,
      totalAvailable,
      canUse
    });

    return canUse;
  }

  /**
   * 使用配额
   */
  useQuota(subreddit: string, amount: number): boolean {
    this.resetIfNewDay();

    if (!this.canUseQuota(subreddit, amount)) {
      return false;
    }

    const subredditQuota = this.subredditQuotas.get(subreddit)!;
    subredditQuota.used += amount;
    this.usedQuota += amount;

    this.logger.debug('Quota used', {
      subreddit,
      amount,
      subredditUsed: subredditQuota.used,
      subredditAllocated: subredditQuota.allocated,
      totalUsed: this.usedQuota,
      totalLimit: this.dailyLimit
    });

    return true;
  }

  /**
   * 获取剩余配额
   */
  getRemainingQuota(subreddit?: string): number {
    this.resetIfNewDay();

    if (subreddit) {
      const subredditQuota = this.subredditQuotas.get(subreddit);
      if (!subredditQuota) {
        return 0;
      }
      return subredditQuota.allocated - subredditQuota.used;
    }

    return this.dailyLimit - this.usedQuota;
  }

  /**
   * 获取配额使用情况
   */
  getQuotaUsage(): {
    date: string;
    totalLimit: number;
    totalUsed: number;
    totalRemaining: number;
    usagePercentage: number;
    subredditBreakdown: Array<{
      subreddit: string;
      allocated: number;
      used: number;
      remaining: number;
      usagePercentage: number;
    }>;
  } {
    this.resetIfNewDay();

    const subredditBreakdown = Array.from(this.subredditQuotas.entries()).map(([subreddit, quota]) => ({
      subreddit,
      allocated: quota.allocated,
      used: quota.used,
      remaining: quota.allocated - quota.used,
      usagePercentage: quota.allocated > 0 ? Math.round((quota.used / quota.allocated) * 100) : 0
    }));

    // 按使用率排序
    subredditBreakdown.sort((a, b) => b.usagePercentage - a.usagePercentage);

    const totalRemaining = this.dailyLimit - this.usedQuota;
    const usagePercentage = Math.round((this.usedQuota / this.dailyLimit) * 100);

    return {
      date: this.currentDate,
      totalLimit: this.dailyLimit,
      totalUsed: this.usedQuota,
      totalRemaining,
      usagePercentage,
      subredditBreakdown
    };
  }

  /**
   * 重新分配未使用的配额
   */
  redistributeUnusedQuota(): {
    redistributed: number;
    beneficiaries: Array<{ subreddit: string; additionalQuota: number }>;
  } {
    this.resetIfNewDay();

    const usage = this.getQuotaUsage();
    const totalUnused = usage.totalRemaining;

    if (totalUnused <= 0) {
      return { redistributed: 0, beneficiaries: [] };
    }

    // 找到使用率高的社区进行重新分配
    const highUsageSubreddits = usage.subredditBreakdown
      .filter(s => s.usagePercentage >= 80 && s.remaining < 50)
      .sort((a, b) => b.usagePercentage - a.usagePercentage);

    const beneficiaries: Array<{ subreddit: string; additionalQuota: number }> = [];
    let redistributed = 0;

    const quotaPerBeneficiary = Math.floor(totalUnused / Math.max(1, highUsageSubreddits.length));

    for (const subredditUsage of highUsageSubreddits) {
      if (redistributed >= totalUnused) break;

      const additionalQuota = Math.min(quotaPerBeneficiary, totalUnused - redistributed);
      const subredditQuota = this.subredditQuotas.get(subredditUsage.subreddit);

      if (subredditQuota && additionalQuota > 0) {
        subredditQuota.allocated += additionalQuota;
        redistributed += additionalQuota;

        beneficiaries.push({
          subreddit: subredditUsage.subreddit,
          additionalQuota
        });

        this.logger.info('Quota redistributed', {
          subreddit: subredditUsage.subreddit,
          additionalQuota,
          newAllocated: subredditQuota.allocated
        });
      }
    }

    this.logger.info('Quota redistribution completed', {
      totalRedistributed: redistributed,
      beneficiaryCount: beneficiaries.length
    });

    return { redistributed, beneficiaries };
  }

  /**
   * 预测配额消耗
   */
  predictQuotaConsumption(
    subreddit: string,
    estimatedPostsPerRequest: number,
    plannedRequests: number
  ): {
    estimatedConsumption: number;
    canComplete: boolean;
    maxPossibleRequests: number;
    recommendation: string;
  } {
    this.resetIfNewDay();

    const estimatedConsumption = estimatedPostsPerRequest * plannedRequests;
    const availableQuota = this.getRemainingQuota(subreddit);
    const canComplete = estimatedConsumption <= availableQuota;
    const maxPossibleRequests = Math.floor(availableQuota / Math.max(1, estimatedPostsPerRequest));

    let recommendation = '';
    if (canComplete) {
      recommendation = 'Proceed with planned requests';
    } else if (maxPossibleRequests > 0) {
      recommendation = `Reduce requests to ${maxPossibleRequests} to stay within quota`;
    } else {
      recommendation = 'No quota available, skip this subreddit';
    }

    return {
      estimatedConsumption,
      canComplete,
      maxPossibleRequests,
      recommendation
    };
  }

  /**
   * 重置配额（新的一天）
   */
  private resetIfNewDay(): void {
    const today = getCurrentDateString();
    
    if (today !== this.currentDate) {
      this.logger.info('New day detected, resetting quotas', {
        previousDate: this.currentDate,
        newDate: today,
        previousUsage: this.usedQuota
      });

      this.currentDate = today;
      this.usedQuota = 0;
      
      // 重置所有社区配额的使用情况
      for (const quota of this.subredditQuotas.values()) {
        quota.used = 0;
      }
    }
  }

  /**
   * 手动重置配额
   */
  resetQuota(): void {
    this.usedQuota = 0;
    for (const quota of this.subredditQuotas.values()) {
      quota.used = 0;
    }
    this.logger.info('Quota manually reset');
  }

  /**
   * 更新每日限制
   */
  updateDailyLimit(newLimit: number): void {
    const oldLimit = this.dailyLimit;
    this.dailyLimit = newLimit;
    
    this.logger.info('Daily limit updated', {
      oldLimit,
      newLimit,
      currentUsage: this.usedQuota
    });
  }

  /**
   * 获取配额统计摘要
   */
  getQuotaSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    details: {
      totalUsage: number;
      totalLimit: number;
      remainingQuota: number;
      activeSubreddits: number;
      highUsageSubreddits: number;
    };
  } {
    this.resetIfNewDay();

    const usage = this.getQuotaUsage();
    const highUsageSubreddits = usage.subredditBreakdown.filter(s => s.usagePercentage >= 80).length;

    let status: 'healthy' | 'warning' | 'critical';
    let message: string;

    if (usage.usagePercentage >= 95) {
      status = 'critical';
      message = 'Quota almost exhausted';
    } else if (usage.usagePercentage >= 80) {
      status = 'warning';
      message = 'High quota usage detected';
    } else {
      status = 'healthy';
      message = 'Quota usage is within normal range';
    }

    return {
      status,
      message,
      details: {
        totalUsage: usage.totalUsed,
        totalLimit: usage.totalLimit,
        remainingQuota: usage.totalRemaining,
        activeSubreddits: usage.subredditBreakdown.length,
        highUsageSubreddits
      }
    };
  }
}
