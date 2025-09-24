-- Reddit AI Crawler v2.0 数据库索引
-- 创建时间: 2025-09-24
-- 使用redditV2_表前缀

-- redditV2_posts表索引
CREATE INDEX IF NOT EXISTS idx_redditV2_posts_subreddit ON redditV2_posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_redditV2_posts_collection_date ON redditV2_posts(collection_date);
CREATE INDEX IF NOT EXISTS idx_redditV2_posts_created_utc ON redditV2_posts(created_utc);
CREATE INDEX IF NOT EXISTS idx_redditV2_posts_score ON redditV2_posts(score);
CREATE INDEX IF NOT EXISTS idx_redditV2_posts_ai_related ON redditV2_posts(is_ai_related);
CREATE INDEX IF NOT EXISTS idx_redditV2_posts_batch_id ON redditV2_posts(collection_batch_id);
CREATE INDEX IF NOT EXISTS idx_redditV2_posts_author ON redditV2_posts(author);
CREATE INDEX IF NOT EXISTS idx_redditV2_posts_upvote_ratio ON redditV2_posts(upvote_ratio);

-- redditV2_collection_stats表索引
CREATE INDEX IF NOT EXISTS idx_redditV2_collection_stats_date ON redditV2_collection_stats(collection_date);
CREATE INDEX IF NOT EXISTS idx_redditV2_collection_stats_subreddit ON redditV2_collection_stats(subreddit);
CREATE INDEX IF NOT EXISTS idx_redditV2_collection_stats_date_subreddit ON redditV2_collection_stats(collection_date, subreddit);
CREATE INDEX IF NOT EXISTS idx_redditV2_collection_stats_batch_id ON redditV2_collection_stats(collection_batch_id);

-- redditV2_error_logs表索引
CREATE INDEX IF NOT EXISTS idx_redditV2_error_logs_type ON redditV2_error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_redditV2_error_logs_subreddit ON redditV2_error_logs(subreddit);
CREATE INDEX IF NOT EXISTS idx_redditV2_error_logs_severity ON redditV2_error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_redditV2_error_logs_resolved ON redditV2_error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_redditV2_error_logs_created_at ON redditV2_error_logs(created_at);

-- redditV2_daily_summary表索引
CREATE INDEX IF NOT EXISTS idx_redditV2_daily_summary_date ON redditV2_daily_summary(summary_date);

-- redditV2_subreddit_configs表索引
CREATE INDEX IF NOT EXISTS idx_redditV2_subreddit_configs_active ON redditV2_subreddit_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_redditV2_subreddit_configs_priority ON redditV2_subreddit_configs(priority);
CREATE INDEX IF NOT EXISTS idx_redditV2_subreddit_configs_last_crawled ON redditV2_subreddit_configs(last_crawled);

-- 复合索引用于常见查询
CREATE INDEX IF NOT EXISTS idx_redditV2_posts_subreddit_date ON redditV2_posts(subreddit, collection_date);
CREATE INDEX IF NOT EXISTS idx_redditV2_posts_ai_score ON redditV2_posts(is_ai_related, score);
CREATE INDEX IF NOT EXISTS idx_redditV2_posts_date_score ON redditV2_posts(collection_date, score);