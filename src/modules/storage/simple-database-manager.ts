import { 
  Env, 
  RedditPost, 
  CollectionStats,
  ErrorLog,
  Logger 
} from '../../types';
import { getCurrentDateString, getUTCTimestamp } from '../../utils/helpers';
import { RedditPostModel } from './models/reddit-post';
import { CollectionStatsModel } from './models/collection-stats';

/**
 * 简化版数据库管理器
 * 专注于基础的数据存储功能，移除复杂的分析功能
 */
export class SimpleDatabaseManager {
  private db: D1Database;
  private logger: Logger;

  constructor(env: Env, logger: Logger) {
    this.db = env.DB;
    this.logger = logger.child('Database');
  }

  /**
   * 测试数据库连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.db.prepare('SELECT 1 as test').first();
      this.logger.debug('Database connection test successful', result);
      return true;
    } catch (error) {
      this.logger.error('Database connection test failed', { error: error.message });
      return false;
    }
  }

  /**
   * 保存单个Reddit帖子
   */
  async savePost(post: RedditPost, batchId: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const now = getUTCTimestamp();
      const collectionDate = getCurrentDateString();

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO redditV2_posts (
          id, subreddit, title, selftext, url, created_utc, collected_at, 
          collection_date, collection_batch_id, author, score, num_comments, 
          upvote_ratio, ups, downs, flair, awards, is_self, is_video,
          ai_relevance_score, is_ai_related
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 
          ?16, ?17, ?18, ?19, ?20, ?21
        )
      `);

      await stmt.bind(
        post.id,
        post.subreddit,
        post.title,
        post.selftext || null,
        post.url,
        post.created_utc,
        now,
        collectionDate,
        batchId,
        post.author || null,
        post.score,
        post.num_comments,
        post.upvote_ratio,
        post.ups || 0,
        post.downs || 0,
        post.flair || null,
        post.awards ? JSON.stringify(post.awards) : null,
        post.is_self,
        post.is_video,
        0.0, // ai_relevance_score - 暂时设为0，后续AI检测时更新
        true  // is_ai_related - 默认为true，后续AI检测时更新
      ).run();

      const duration = Date.now() - startTime;
      this.logger.database('INSERT', 'reddit_posts', 1, duration);
      
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to save post', { 
        postId: post.id, 
        error: error.message,
        duration 
      });
      return false;
    }
  }

  /**
   * 批量保存Reddit帖子（带数据验证）
   */
  async savePosts(posts: RedditPost[], batchId: string): Promise<{ saved: number; failed: number }> {
    if (posts.length === 0) {
      return { saved: 0, failed: 0 };
    }

    const startTime = Date.now();
    this.logger.batch(batchId, 'Saving posts', posts.length);

    let saved = 0;
    let failed = 0;

    try {
      const now = getUTCTimestamp();
      const collectionDate = getCurrentDateString();

      // 过滤出符合基础质量要求的帖子
      const validPosts = posts.filter(post => {
        const validation = RedditPostModel.validate(post);
        if (!validation.isValid) {
          this.logger.warn('Invalid post data', { postId: post.id, errors: validation.errors });
          failed++;
          return false;
        }
        
        if (!RedditPostModel.meetsBasicQuality(post)) {
          this.logger.debug('Post does not meet basic quality requirements', { postId: post.id });
          failed++;
          return false;
        }
        
        return true;
      });

      if (validPosts.length === 0) {
        this.logger.warn('No valid posts to save', { batchId, originalCount: posts.length });
        return { saved: 0, failed: posts.length };
      }

      // 创建批量插入语句
      const statements = validPosts.map(post => {
        return this.db.prepare(`
          INSERT OR REPLACE INTO reddit_posts (
            id, subreddit, title, selftext, url, created_utc, collected_at, 
            collection_date, collection_batch_id, author, score, num_comments, 
            upvote_ratio, ups, downs, flair, awards, is_self, is_video,
            ai_relevance_score, is_ai_related
          ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 
            ?16, ?17, ?18, ?19, ?20, ?21
          )
        `).bind(
          post.id,
          post.subreddit,
          post.title,
          post.selftext || null,
          post.url,
          post.created_utc,
          now,
          collectionDate,
          batchId,
          post.author || null,
          post.score,
          post.num_comments,
          post.upvote_ratio,
          post.ups || 0,
          post.downs || 0,
          post.flair || null,
          post.awards ? JSON.stringify(post.awards) : null,
          post.is_self,
          post.is_video,
          0.0, // ai_relevance_score - 后续AI检测时更新
          true  // is_ai_related - 默认为true，后续AI检测时更新
        );
      });

      // 执行批量插入
      await this.db.batch(statements);
      saved = validPosts.length;

      const duration = Date.now() - startTime;
      this.logger.database('BATCH_INSERT', 'reddit_posts', saved, duration);
      this.logger.batch(batchId, 'Posts saved successfully', saved, { failed });

    } catch (error) {
      failed = posts.length - saved;
      const duration = Date.now() - startTime;
      this.logger.error('Batch save failed', { 
        batchId, 
        count: posts.length, 
        saved,
        error: error.message,
        duration 
      });
    }

    return { saved, failed };
  }

  /**
   * 更新帖子的AI相关性信息
   */
  async updatePostAIRelevance(postId: string, aiScore: number, isAiRelated: boolean): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        UPDATE redditV2_posts 
        SET ai_relevance_score = ?1, is_ai_related = ?2, updated_at = strftime('%s', 'now')
        WHERE id = ?3
      `);

      await stmt.bind(aiScore, isAiRelated, postId).run();
      this.logger.debug('Updated AI relevance', { postId, aiScore, isAiRelated });
      return true;
    } catch (error) {
      this.logger.error('Failed to update AI relevance', { postId, error: error.message });
      return false;
    }
  }

  /**
   * 检查帖子是否已存在
   */
  async postExists(postId: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM redditV2_posts WHERE id = ?1 LIMIT 1');
      const result = await stmt.bind(postId).first();
      return !!result;
    } catch (error) {
      this.logger.error('Failed to check post existence', { postId, error: error.message });
      return false;
    }
  }

  /**
   * 保存采集统计信息
   */
  async saveCollectionStats(stats: Omit<CollectionStats, 'id' | 'created_at'>): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO redditV2_collection_stats (
          collection_date, collection_batch_id, subreddit, total_fetched,
          total_filtered, total_saved, start_time, end_time, 
          duration_seconds, status, error_message
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      `);

      await stmt.bind(
        stats.collection_date,
        stats.collection_batch_id,
        stats.subreddit,
        stats.total_fetched,
        stats.total_filtered,
        stats.total_saved,
        stats.start_time,
        stats.end_time,
        stats.duration_seconds,
        stats.status,
        stats.error_message
      ).run();

      this.logger.database('INSERT', 'collection_stats', 1);
      return true;
    } catch (error) {
      this.logger.error('Failed to save collection stats', { 
        batchId: stats.collection_batch_id, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * 记录错误日志
   */
  async logError(errorLog: Omit<ErrorLog, 'id' | 'created_at'>): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO redditV2_error_logs (
          error_type, error_message, subreddit, collection_batch_id, severity, resolved
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      `);

      await stmt.bind(
        errorLog.error_type,
        errorLog.error_message,
        errorLog.subreddit,
        errorLog.collection_batch_id,
        errorLog.severity,
        errorLog.resolved
      ).run();

      this.logger.database('INSERT', 'error_logs', 1);
      return true;
    } catch (error) {
      this.logger.error('Failed to log error', { error: error.message });
      return false;
    }
  }

  /**
   * 获取今日基础统计
   */
  async getTodayStats(): Promise<{
    totalPosts: number;
    totalSubreddits: number;
    aiRelatedPosts: number;
  }> {
    const today = getCurrentDateString();

    try {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total_posts,
          COUNT(DISTINCT subreddit) as total_subreddits,
          COUNT(CASE WHEN is_ai_related = 1 THEN 1 END) as ai_related_posts
        FROM redditV2_posts 
        WHERE collection_date = ?1
      `);

      const result = await stmt.bind(today).first() as any;

      return {
        totalPosts: result?.total_posts || 0,
        totalSubreddits: result?.total_subreddits || 0,
        aiRelatedPosts: result?.ai_related_posts || 0
      };
    } catch (error) {
      this.logger.error('Failed to get today stats', { error: error.message });
      return {
        totalPosts: 0,
        totalSubreddits: 0,
        aiRelatedPosts: 0
      };
    }
  }

  /**
   * 获取最近的帖子列表
   */
  async getRecentPosts(limit: number = 10, subreddit?: string): Promise<any[]> {
    try {
      let query = `
        SELECT id, subreddit, title, score, num_comments, upvote_ratio, 
               ai_relevance_score, is_ai_related, collected_at
        FROM redditV2_posts 
      `;
      
      const params: any[] = [];

      if (subreddit) {
        query += ` WHERE subreddit = ?1`;
        params.push(subreddit);
      }

      query += ` ORDER BY collected_at DESC LIMIT ?${params.length + 1}`;
      params.push(limit);

      const stmt = this.db.prepare(query);
      const results = await stmt.bind(...params).all();

      return results.results || [];
    } catch (error) {
      this.logger.error('Failed to get recent posts', { error: error.message });
      return [];
    }
  }

  /**
   * 清理旧数据
   */
  async cleanupOldData(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      const stmt = this.db.prepare(`
        DELETE FROM redditV2_posts WHERE collection_date < ?1
      `);

      const result = await stmt.bind(cutoffDateStr).run();
      const deletedCount = result.changes || 0;

      this.logger.info('Old data cleanup completed', { 
        deletedCount, 
        cutoffDate: cutoffDateStr 
      });

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old data', { error: error.message });
      return 0;
    }
  }

  /**
   * 获取数据库健康状态
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    totalPosts: number;
    todayPosts: number;
    lastCollectionTime: string | null;
  }> {
    try {
      // 检查连接
      const connectionOk = await this.testConnection();
      if (!connectionOk) {
        return {
          isHealthy: false,
          totalPosts: 0,
          todayPosts: 0,
          lastCollectionTime: null
        };
      }

      // 获取统计信息
      const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM redditV2_posts');
      const totalResult = await totalStmt.first() as any;
      const totalPosts = totalResult?.count || 0;

      const todayStats = await this.getTodayStats();
      
      // 获取最后采集时间
      const lastStmt = this.db.prepare(`
        SELECT MAX(collected_at) as last_time FROM redditV2_posts
      `);
      const lastResult = await lastStmt.first() as any;
      const lastCollectionTime = lastResult?.last_time 
        ? new Date(lastResult.last_time * 1000).toISOString()
        : null;

      return {
        isHealthy: true,
        totalPosts,
        todayPosts: todayStats.totalPosts,
        lastCollectionTime
      };
    } catch (error) {
      this.logger.error('Failed to get health status', { error: error.message });
      return {
        isHealthy: false,
        totalPosts: 0,
        todayPosts: 0,
        lastCollectionTime: null
      };
    }
  }
}
