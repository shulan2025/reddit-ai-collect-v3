import { RedditPost, Logger } from '../../types';
import { isPostWithinTimeRange, calculateTextQuality } from '../../utils/helpers';

/**
 * 过滤配置接口
 */
interface FilterConfig {
    // 基础数值过滤
    minScore: number;           // 最小净点赞数
    minComments: number;        // 最小评论数
    minUpvoteRatio: number;     // 最小点赞率
    
    // 时间过滤
    maxAgeHours: number;        // 最大帖子年龄（小时）
    minAgeMinutes: number;      // 最小帖子年龄（分钟）
    
    // 内容过滤
    minTitleLength: number;     // 最小标题长度
    minSelfTextLength: number;  // 最小正文长度（如有正文）
    
    // 作者过滤
    excludeDeletedUsers: boolean;        // 排除已删除用户
    excludeShadowBannedUsers: boolean;   // 排除被影子封禁用户
    
    // 内容类型过滤
    allowSelfPosts: boolean;    // 允许文本帖
    allowLinkPosts: boolean;    // 允许链接帖
  allowVideoPosts: boolean;   // 允许视频帖
}

/**
 * 简化版帖子过滤器
 * 专注于基础的数值和质量过滤，移除复杂的分析功能
 */
export class SimplePostFilter {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child('Filter');
  }

  /**
   * 默认过滤配置
   */
  private getDefaultConfig(): FilterConfig {
    return {
      minScore: 10,
      minComments: 5,
      minUpvoteRatio: 0.1,
      maxAgeHours: 720, // 30天
      minAgeMinutes: 5,
      minTitleLength: 15,
      minSelfTextLength: 50,
      excludeDeletedUsers: true,
      excludeShadowBannedUsers: true,
      allowSelfPosts: true,
      allowLinkPosts: true,
      allowVideoPosts: true
    };
  }

  /**
   * 应用所有过滤规则
   */
  filterPosts(
    posts: RedditPost[], 
    config: Partial<FilterConfig> = {}
  ): {
    passed: RedditPost[];
    filtered: RedditPost[];
    stats: {
      total: number;
      passed: number;
      filtered: number;
      filterReasons: Record<string, number>;
    };
  } {
    const fullConfig = { ...this.getDefaultConfig(), ...config };
    const passed: RedditPost[] = [];
    const filtered: RedditPost[] = [];
    const filterReasons: Record<string, number> = {};

    this.logger.info('Starting post filtering', {
      totalPosts: posts.length,
      config: fullConfig
    });

    for (const post of posts) {
      const filterResult = this.checkPost(post, fullConfig);
      
      if (filterResult.passed) {
        passed.push(post);
      } else {
        filtered.push(post);
        
        // 统计过滤原因
        for (const reason of filterResult.reasons) {
          filterReasons[reason] = (filterReasons[reason] || 0) + 1;
        }
      }
    }

    const stats = {
      total: posts.length,
      passed: passed.length,
      filtered: filtered.length,
      filterReasons
    };

    this.logger.info('Post filtering completed', stats);

    return { passed, filtered, stats };
  }

  /**
   * 检查单个帖子是否通过过滤
   */
  private checkPost(
    post: RedditPost, 
    config: FilterConfig
  ): {
    passed: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    // 基础数值检查
    if (post.score < config.minScore) {
      reasons.push(`low_score:${post.score}<${config.minScore}`);
    }

    if (post.num_comments < config.minComments) {
      reasons.push(`low_comments:${post.num_comments}<${config.minComments}`);
    }

    if (post.upvote_ratio !== null && post.upvote_ratio < config.minUpvoteRatio) {
      reasons.push(`low_upvote_ratio:${post.upvote_ratio}<${config.minUpvoteRatio}`);
    }

    // 时间检查
    if (!isPostWithinTimeRange(post.created_utc, config.maxAgeHours)) {
      reasons.push(`too_old:>${config.maxAgeHours}h`);
    }

    const now = Math.floor(Date.now() / 1000);
    const ageMinutes = (now - post.created_utc) / 60;
    if (ageMinutes < config.minAgeMinutes) {
      reasons.push(`too_new:<${config.minAgeMinutes}m`);
    }

    // 内容长度检查
    if (post.title.length < config.minTitleLength) {
      reasons.push(`short_title:${post.title.length}<${config.minTitleLength}`);
    }

    if (post.is_self && post.selftext && 
        post.selftext.length < config.minSelfTextLength) {
      reasons.push(`short_selftext:${post.selftext.length}<${config.minSelfTextLength}`);
    }

    // 作者检查
    if (config.excludeDeletedUsers && (!post.author || post.author === '[deleted]')) {
      reasons.push('deleted_author');
    }

    // 内容类型检查
    if (!config.allowSelfPosts && post.is_self) {
      reasons.push('self_post_not_allowed');
    }

    if (!config.allowLinkPosts && !post.is_self && !post.is_video) {
      reasons.push('link_post_not_allowed');
    }

    if (!config.allowVideoPosts && post.is_video) {
      reasons.push('video_post_not_allowed');
    }

    // 内容质量检查
    const qualityReasons = this.checkContentQuality(post);
    reasons.push(...qualityReasons);

    return {
      passed: reasons.length === 0,
      reasons
    };
  }

  /**
   * 检查内容质量
   */
  private checkContentQuality(post: RedditPost): string[] {
    const reasons: string[] = [];

    // 检查标题质量
    const titleLower = post.title.toLowerCase();
    
    // 检查是否为删除或移除的帖子
    if (titleLower.includes('[deleted]') || titleLower.includes('[removed]')) {
      reasons.push('deleted_content');
    }

    // 检查是否为垃圾标题
    const spamIndicators = [
      'click here',
      'free download',
      'make money',
      'buy now',
      '100% free'
    ];

    if (spamIndicators.some(indicator => titleLower.includes(indicator))) {
      reasons.push('spam_indicators');
    }

    // 检查标题是否过于简短或无意义
    const meaninglessPatterns = [
      /^(this|that|it|wow|lol|omg|wtf)$/i,
      /^[.!?]+$/,
      /^[0-9]+$/
    ];

    if (meaninglessPatterns.some(pattern => pattern.test(post.title.trim()))) {
      reasons.push('meaningless_title');
    }

    // 检查是否有过多的大写字母（可能是垃圾内容）
    const uppercaseRatio = (post.title.match(/[A-Z]/g) || []).length / post.title.length;
    if (uppercaseRatio > 0.5 && post.title.length > 10) {
      reasons.push('excessive_caps');
    }

    // 检查是否有过多的特殊字符
    const specialCharRatio = (post.title.match(/[^a-zA-Z0-9\s]/g) || []).length / post.title.length;
    if (specialCharRatio > 0.3) {
      reasons.push('excessive_special_chars');
    }

    return reasons;
  }

  /**
   * 按社区应用不同的过滤标准
   */
  filterPostsBySubreddit(
    postsBySubreddit: Map<string, RedditPost[]>,
    subredditConfigs: Map<string, {
      minScore: number;
      minComments: number;
      minUpvoteRatio: number;
    }>
  ): {
    results: Map<string, {
      passed: RedditPost[];
      filtered: RedditPost[];
      stats: any;
    }>;
    overallStats: {
      totalPosts: number;
      totalPassed: number;
      totalFiltered: number;
      subredditStats: Array<{
        subreddit: string;
        total: number;
        passed: number;
        filtered: number;
        passRate: number;
      }>;
    };
  } {
    const results = new Map();
    const subredditStats: any[] = [];
    let totalPosts = 0;
    let totalPassed = 0;
    let totalFiltered = 0;

    for (const [subreddit, posts] of postsBySubreddit) {
      const subredditConfig = subredditConfigs.get(subreddit) || {};
      
      // 为每个社区应用特定配置
      const filterConfig: Partial<FilterConfig> = {
        minScore: subredditConfig.minScore || 10,
        minComments: subredditConfig.minComments || 5,
        minUpvoteRatio: subredditConfig.minUpvoteRatio || 0.1
      };

      const result = this.filterPosts(posts, filterConfig);
      results.set(subreddit, result);

      // 统计信息
      const passRate = posts.length > 0 ? (result.passed.length / posts.length) * 100 : 0;
      subredditStats.push({
        subreddit,
        total: posts.length,
        passed: result.passed.length,
        filtered: result.filtered.length,
        passRate: Math.round(passRate)
      });

      totalPosts += posts.length;
      totalPassed += result.passed.length;
      totalFiltered += result.filtered.length;
    }

    // 按通过率排序
    subredditStats.sort((a, b) => b.passRate - a.passRate);

    const overallStats = {
      totalPosts,
      totalPassed,
      totalFiltered,
      subredditStats
    };

    this.logger.info('Batch filtering completed', overallStats);

    return { results, overallStats };
  }

  /**
   * 获取过滤统计摘要
   */
  getFilterSummary(stats: {
    total: number;
    passed: number;
    filtered: number;
    filterReasons: Record<string, number>;
  }): {
    passRate: number;
    topFilterReasons: Array<{ reason: string; count: number; percentage: number }>;
    summary: string;
  } {
    const passRate = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
    
    // 获取前5个过滤原因
    const topFilterReasons = Object.entries(stats.filterReasons)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: Math.round((count / stats.total) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const summary = `Filtered ${stats.total} posts: ${stats.passed} passed (${Math.round(passRate)}%), ${stats.filtered} filtered`;

    return {
      passRate: Math.round(passRate),
      topFilterReasons,
      summary
    };
  }

  /**
   * 验证过滤配置
   */
  validateConfig(config: Partial<FilterConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.minScore !== undefined && (config.minScore < 0 || config.minScore > 10000)) {
      errors.push('minScore must be between 0 and 10000');
    }

    if (config.minComments !== undefined && (config.minComments < 0 || config.minComments > 1000)) {
      errors.push('minComments must be between 0 and 1000');
    }

    if (config.minUpvoteRatio !== undefined && (config.minUpvoteRatio < 0 || config.minUpvoteRatio > 1)) {
      errors.push('minUpvoteRatio must be between 0 and 1');
    }

    if (config.maxAgeHours !== undefined && (config.maxAgeHours < 1 || config.maxAgeHours > 8760)) {
      errors.push('maxAgeHours must be between 1 and 8760 (1 year)');
    }

    if (config.minTitleLength !== undefined && (config.minTitleLength < 1 || config.minTitleLength > 300)) {
      errors.push('minTitleLength must be between 1 and 300');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
