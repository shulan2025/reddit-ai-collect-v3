import { 
  Env, 
  DBRedditPost, 
  SubredditConfig, 
  CollectionStats, 
  DailySummary, 
  ErrorLog,
  RedditPost,
  PostScores,
  Logger 
} from '../../types';

export class DatabaseManager {
  private db: D1Database;
  private logger: Logger;

  constructor(env: Env, logger: Logger) {
    this.db = env.DB;
    this.logger = logger;
  }

  /**
   * 初始化数据库表
   */
  async initializeTables(): Promise<void> {
    this.logger.info('开始初始化数据库表');

    try {
      // 这里可以执行数据库迁移脚本
      // 在实际部署时，表结构应该通过wrangler d1 migrations来管理
      this.logger.info('数据库表初始化完成');
    } catch (error) {
      this.logger.error('数据库表初始化失败', { error });
      throw error;
    }
  }

  /**
   * 保存Reddit帖子
   */
  async savePost(
    post: RedditPost, 
    scores: PostScores, 
    collectionBatchId: string
  ): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const collectionDate = new Date().toISOString().split('T')[0];

    const dbPost: Omit<DBRedditPost, 'created_at' | 'updated_at'> = {
      id: post.id,
      subreddit: post.subreddit,
      title: post.title,
      selftext: post.selftext || null,
      url: post.url,
      created_utc: post.created_utc,
      collected_at: now,
      collection_date: collectionDate,
      collection_batch_id: collectionBatchId,
      author: post.author || null,
      author_karma: null, // 需要额外API调用获取
      author_created_utc: null,
      score: post.score,
      num_comments: post.num_comments,
      upvote_ratio: post.upvote_ratio,
      ups: post.ups || 0,
      downs: post.downs || 0,
      flair: post.flair || null,
      awards: post.awards ? JSON.stringify(post.awards) : null,
      is_self: post.is_self,
      is_video: post.is_video,
      top_comments: null, // 稍后填充
      heat_score: scores.heatScore,
      quality_score: scores.qualityScore,
      ai_relevance_score: scores.aiRelevanceScore,
      is_ai_related: scores.aiRelevanceScore >= 2.0,
      is_processed: false,
      processing_status: 'pending'
    };

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO reddit_posts (
          id, subreddit, title, selftext, url, created_utc, collected_at, 
          collection_date, collection_batch_id, author, author_karma, author_created_utc,
          score, num_comments, upvote_ratio, ups, downs, flair, awards, 
          is_self, is_video, top_comments, heat_score, quality_score, 
          ai_relevance_score, is_ai_related, is_processed, processing_status
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 
          ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28
        )
      `);

      await stmt.bind(
        dbPost.id, dbPost.subreddit, dbPost.title, dbPost.selftext, dbPost.url,
        dbPost.created_utc, dbPost.collected_at, dbPost.collection_date, 
        dbPost.collection_batch_id, dbPost.author, dbPost.author_karma, 
        dbPost.author_created_utc, dbPost.score, dbPost.num_comments, 
        dbPost.upvote_ratio, dbPost.ups, dbPost.downs, dbPost.flair, 
        dbPost.awards, dbPost.is_self, dbPost.is_video, dbPost.top_comments,
        dbPost.heat_score, dbPost.quality_score, dbPost.ai_relevance_score,
        dbPost.is_ai_related, dbPost.is_processed, dbPost.processing_status
      ).run();

      this.logger.debug('帖子保存成功', { postId: post.id, subreddit: post.subreddit });
      return true;
    } catch (error) {
      this.logger.error('帖子保存失败', { postId: post.id, error });
      return false;
    }
  }

  /**
   * 批量保存帖子
   */
  async savePosts(
    posts: Array<{ post: RedditPost; scores: PostScores }>,
    collectionBatchId: string
  ): Promise<{ saved: number; failed: number }> {
    let saved = 0;
    let failed = 0;

    // 使用事务批量插入
    try {
      const statements = posts.map(({ post, scores }) => {
        const now = Math.floor(Date.now() / 1000);
        const collectionDate = new Date().toISOString().split('T')[0];

        return this.db.prepare(`
          INSERT OR REPLACE INTO reddit_posts (
            id, subreddit, title, selftext, url, created_utc, collected_at, 
            collection_date, collection_batch_id, author, score, num_comments, 
            upvote_ratio, ups, downs, flair, awards, is_self, is_video, 
            heat_score, quality_score, ai_relevance_score, is_ai_related, 
            is_processed, processing_status
          ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 
            ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25
          )
        `).bind(
          post.id, post.subreddit, post.title, post.selftext || null, post.url,
          post.created_utc, now, collectionDate, collectionBatchId, 
          post.author || null, post.score, post.num_comments, post.upvote_ratio,
          post.ups || 0, post.downs || 0, post.flair || null,
          post.awards ? JSON.stringify(post.awards) : null,
          post.is_self, post.is_video, scores.heatScore, scores.qualityScore,
          scores.aiRelevanceScore, scores.aiRelevanceScore >= 2.0, false, 'pending'
        );
      });

      await this.db.batch(statements);
      saved = posts.length;

      this.logger.info('批量保存帖子完成', { 
        total: posts.length, 
        saved, 
        batchId: collectionBatchId 
      });
    } catch (error) {
      this.logger.error('批量保存帖子失败', { error });
      failed = posts.length;
    }

    return { saved, failed };
  }

  /**
   * 获取子版块配置
   */
  async getSubredditConfig(subreddit: string): Promise<SubredditConfig | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM subreddit_configs WHERE subreddit_name = ?1
      `);
      
      const result = await stmt.bind(subreddit).first();
      return result as SubredditConfig | null;
    } catch (error) {
      this.logger.error('获取子版块配置失败', { subreddit, error });
      return null;
    }
  }

  /**
   * 更新子版块配置
   */
  async updateSubredditConfig(config: Partial<SubredditConfig> & { subreddit_name: string }): Promise<boolean> {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO subreddit_configs (
          subreddit_name, is_active, priority, daily_quota, min_score, 
          min_comments, min_upvote_ratio, weight_multiplier, last_crawled, 
          total_collected, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      `);

      await stmt.bind(
        config.subreddit_name,
        config.is_active ?? true,
        config.priority ?? 1,
        config.daily_quota ?? 50,
        config.min_score ?? 10,
        config.min_comments ?? 5,
        config.min_upvote_ratio ?? 0.65,
        config.weight_multiplier ?? 1.0,
        config.last_crawled ?? null,
        config.total_collected ?? 0,
        now
      ).run();

      this.logger.debug('子版块配置更新成功', { subreddit: config.subreddit_name });
      return true;
    } catch (error) {
      this.logger.error('子版块配置更新失败', { subreddit: config.subreddit_name, error });
      return false;
    }
  }

  /**
   * 保存采集统计
   */
  async saveCollectionStats(stats: Omit<CollectionStats, 'id' | 'created_at'>): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO collection_stats (
          collection_date, collection_batch_id, subreddit, total_fetched,
          total_filtered, total_saved, avg_score, avg_comments, avg_upvote_ratio,
          avg_heat_score, avg_quality_score, start_time, end_time, 
          duration_seconds, status, error_message
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
      `);

      await stmt.bind(
        stats.collection_date, stats.collection_batch_id, stats.subreddit,
        stats.total_fetched, stats.total_filtered, stats.total_saved,
        stats.avg_score, stats.avg_comments, stats.avg_upvote_ratio,
        stats.avg_heat_score, stats.avg_quality_score, stats.start_time,
        stats.end_time, stats.duration_seconds, stats.status, stats.error_message
      ).run();

      this.logger.debug('采集统计保存成功', { 
        batchId: stats.collection_batch_id, 
        subreddit: stats.subreddit 
      });
      return true;
    } catch (error) {
      this.logger.error('采集统计保存失败', { 
        batchId: stats.collection_batch_id, 
        error 
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
        INSERT INTO error_logs (
          error_type, error_message, error_details, subreddit, post_id,
          collection_batch_id, severity, resolved
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `);

      await stmt.bind(
        errorLog.error_type, errorLog.error_message, errorLog.error_details,
        errorLog.subreddit, errorLog.post_id, errorLog.collection_batch_id,
        errorLog.severity, errorLog.resolved
      ).run();

      return true;
    } catch (error) {
      this.logger.error('错误日志记录失败', { error });
      return false;
    }
  }

  /**
   * 获取今日统计
   */
  async getTodayStats(): Promise<{
    totalPosts: number;
    totalSubreddits: number;
    avgHeatScore: number;
    avgQualityScore: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    try {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total_posts,
          COUNT(DISTINCT subreddit) as total_subreddits,
          AVG(heat_score) as avg_heat_score,
          AVG(quality_score) as avg_quality_score
        FROM reddit_posts 
        WHERE collection_date = ?1
      `);

      const result = await stmt.bind(today).first() as any;

      return {
        totalPosts: result?.total_posts || 0,
        totalSubreddits: result?.total_subreddits || 0,
        avgHeatScore: result?.avg_heat_score || 0,
        avgQualityScore: result?.avg_quality_score || 0
      };
    } catch (error) {
      this.logger.error('获取今日统计失败', { error });
      return {
        totalPosts: 0,
        totalSubreddits: 0,
        avgHeatScore: 0,
        avgQualityScore: 0
      };
    }
  }

  /**
   * 检查帖子是否已存在
   */
  async postExists(postId: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        SELECT 1 FROM reddit_posts WHERE id = ?1 LIMIT 1
      `);
      
      const result = await stmt.bind(postId).first();
      return !!result;
    } catch (error) {
      this.logger.error('检查帖子存在性失败', { postId, error });
      return false;
    }
  }

  /**
   * 获取热门帖子
   */
  async getTopPosts(
    limit: number = 10, 
    subreddit?: string, 
    days: number = 1
  ): Promise<DBRedditPost[]> {
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);
      const thresholdDate = dateThreshold.toISOString().split('T')[0];

      let query = `
        SELECT * FROM reddit_posts 
        WHERE collection_date >= ?1
      `;
      
      const params: any[] = [thresholdDate];

      if (subreddit) {
        query += ` AND subreddit = ?2`;
        params.push(subreddit);
      }

      query += ` ORDER BY heat_score DESC, quality_score DESC LIMIT ?${params.length + 1}`;
      params.push(limit);

      const stmt = this.db.prepare(query);
      const results = await stmt.bind(...params).all();

      return results.results as DBRedditPost[];
    } catch (error) {
      this.logger.error('获取热门帖子失败', { error });
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
        DELETE FROM reddit_posts WHERE collection_date < ?1
      `);

      const result = await stmt.bind(cutoffDateStr).run();
      const deletedCount = result.changes || 0;

      this.logger.info('旧数据清理完成', { 
        deletedCount, 
        cutoffDate: cutoffDateStr 
      });

      return deletedCount;
    } catch (error) {
      this.logger.error('清理旧数据失败', { error });
      return 0;
    }
  }
}
