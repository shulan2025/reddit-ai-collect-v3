import { RedditPost, Logger } from '../../types';
import { SimplePostFilter } from './simple-filter';
import { AIRelevanceDetector } from './ai-detector';

/**
 * 帖子处理器
 * 整合基础过滤和AI相关性检测功能
 */
export class PostProcessor {
  private filter: SimplePostFilter;
  private aiDetector: AIRelevanceDetector;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child('PostProcessor');
    this.filter = new SimplePostFilter(this.logger);
    this.aiDetector = new AIRelevanceDetector(this.logger);
  }

  /**
   * 处理单个帖子
   */
  async processSinglePost(
    post: RedditPost,
    config: {
      filterConfig?: any;
      enableAIDetection?: boolean;
      aiThreshold?: number;
    } = {}
  ): Promise<{
    post: RedditPost;
    passed: boolean;
    filterResult?: any;
    aiResult?: any;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const { filterConfig = {}, enableAIDetection = true, aiThreshold = 2.0 } = config;

    try {
      // 1. 基础过滤
      const filterResult = this.filter.filterPosts([post], filterConfig);
      const passedFilter = filterResult.passed.length > 0;

      let aiResult = null;
      let passedAI = true;

      // 2. AI相关性检测（仅对通过基础过滤的帖子）
      if (passedFilter && enableAIDetection) {
        aiResult = await this.aiDetector.detectAIRelevance(post);
        passedAI = aiResult.relevanceScore >= aiThreshold;
      }

      const finalPassed = passedFilter && passedAI;
      const processingTime = Date.now() - startTime;

      this.logger.debug('Single post processed', {
        postId: post.id,
        subreddit: post.subreddit,
        passedFilter,
        passedAI,
        finalPassed,
        processingTime
      });

      return {
        post,
        passed: finalPassed,
        filterResult: filterResult.stats,
        aiResult,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Single post processing failed', {
        postId: post.id,
        error: error.message,
        processingTime
      });

      return {
        post,
        passed: false,
        processingTime
      };
    }
  }

  /**
   * 批量处理帖子
   */
  async processPosts(
    posts: RedditPost[],
    config: {
      filterConfig?: any;
      enableAIDetection?: boolean;
      aiThreshold?: number;
      batchSize?: number;
    } = {}
  ): Promise<{
    processed: RedditPost[];
    filtered: RedditPost[];
    stats: {
      total: number;
      processed: number;
      filtered: number;
      filterStats: any;
      aiStats?: {
        totalChecked: number;
        aiRelated: number;
        nonAiRelated: number;
        averageScore: number;
      };
      processingTime: number;
    };
  }> {
    const startTime = Date.now();
    const { 
      filterConfig = {}, 
      enableAIDetection = true, 
      aiThreshold = 2.0,
      batchSize = 100 
    } = config;

    this.logger.info('Starting batch post processing', {
      totalPosts: posts.length,
      enableAIDetection,
      aiThreshold,
      batchSize
    });

    try {
      // 1. 基础过滤
      const filterResult = this.filter.filterPosts(posts, filterConfig);
      const filteredPosts = filterResult.passed;

      this.logger.info('Basic filtering completed', {
        original: posts.length,
        passed: filteredPosts.length,
        filtered: filterResult.filtered.length
      });

      let finalProcessed = filteredPosts;
      let aiStats = null;

      // 2. AI相关性检测
      if (enableAIDetection && filteredPosts.length > 0) {
        const aiResults = await this.aiDetector.batchDetectAIRelevance(filteredPosts);
        
        // 过滤出AI相关的帖子
        finalProcessed = filteredPosts.filter(post => {
          const aiResult = aiResults.get(post.id);
          return aiResult && aiResult.relevanceScore >= aiThreshold;
        });

        // 计算AI检测统计
        const aiScores = Array.from(aiResults.values()).map(r => r.relevanceScore);
        const aiRelatedCount = Array.from(aiResults.values()).filter(r => r.isAIRelated).length;
        
        aiStats = {
          totalChecked: filteredPosts.length,
          aiRelated: aiRelatedCount,
          nonAiRelated: filteredPosts.length - aiRelatedCount,
          averageScore: aiScores.length > 0 
            ? Math.round((aiScores.reduce((sum, score) => sum + score, 0) / aiScores.length) * 100) / 100
            : 0
        };

        this.logger.info('AI relevance detection completed', aiStats);
      }

      const processingTime = Date.now() - startTime;
      const filtered = posts.filter(post => !finalProcessed.includes(post));

      const stats = {
        total: posts.length,
        processed: finalProcessed.length,
        filtered: filtered.length,
        filterStats: filterResult.stats,
        aiStats,
        processingTime
      };

      this.logger.info('Batch post processing completed', {
        ...stats,
        processingTimeSeconds: Math.round(processingTime / 1000)
      });

      return {
        processed: finalProcessed,
        filtered,
        stats
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Batch post processing failed', {
        error: error.message,
        processingTime
      });

      return {
        processed: [],
        filtered: posts,
        stats: {
          total: posts.length,
          processed: 0,
          filtered: posts.length,
          filterStats: { total: posts.length, passed: 0, filtered: posts.length, filterReasons: {} },
          processingTime
        }
      };
    }
  }

  /**
   * 获取处理器状态
   */
  getStatus(): {
    filter: any;
    aiDetector: any;
  } {
    return {
      filter: 'Ready',
      aiDetector: this.aiDetector.getStats()
    };
  }

  /**
   * 重置处理器
   */
  reset(): void {
    this.aiDetector.clearKeywordsCache();
    this.logger.info('Post processor reset');
  }
}