-- 第四批：创建索引和配置数据
-- 主表索引
CREATE INDEX idx_posts_subreddit ON reddit_ai_posts(subreddit);
CREATE INDEX idx_posts_created_utc ON reddit_ai_posts(created_utc DESC);
CREATE INDEX idx_posts_score ON reddit_ai_posts(score DESC);
CREATE INDEX idx_posts_quality_score ON reddit_ai_posts(quality_score DESC);
CREATE INDEX idx_posts_crawl_date ON reddit_ai_posts(crawl_date);

-- 关键词表索引
CREATE INDEX idx_keywords_post_id ON reddit_post_keywords(post_id);
CREATE INDEX idx_keywords_keyword ON reddit_post_keywords(keyword);

-- 插入系统配置
INSERT INTO reddit_system_config (config_key, config_value, config_type, description) VALUES
('daily_target_posts', '200', 'integer', '每日目标帖子数量'),
('crawl_time_beijing', '06:00', 'string', '北京时间每日采集时间'),
('enable_daily_dedup', 'true', 'boolean', '启用按日去重功能'),
('last_crawl_timestamp', '0', 'integer', '最后爬取时间戳');
