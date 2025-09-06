-- Cloudflare D1 数据库初始化脚本
-- 使用说明: 在 Cloudflare Dashboard 的 D1 控制台中执行此脚本

-- ============================================
-- 执行顺序说明
-- ============================================
-- 1. 首先创建所有表结构
-- 2. 然后创建索引
-- 3. 最后插入配置数据和创建视图

-- ============================================
-- 第一步: 创建表结构 (按执行顺序分组)
-- ============================================

-- 1.1 主表
CREATE TABLE reddit_ai_posts (
    id TEXT PRIMARY KEY,
    permalink TEXT NOT NULL,
    url TEXT,
    title TEXT NOT NULL,
    selftext TEXT,
    selftext_html TEXT,
    score INTEGER DEFAULT 0,
    upvote_ratio REAL DEFAULT 0,
    num_comments INTEGER DEFAULT 0,
    total_awards_received INTEGER DEFAULT 0,
    num_crossposts INTEGER DEFAULT 0,
    author TEXT,
    subreddit TEXT NOT NULL,
    subreddit_subscribers INTEGER,
    created_utc INTEGER NOT NULL,
    quality_score REAL DEFAULT 0,
    content_category TEXT,
    tech_relevance_score REAL DEFAULT 0,
    ai_category TEXT,
    processed_at INTEGER DEFAULT (unixepoch()),
    extraction_status TEXT DEFAULT 'pending',
    last_updated INTEGER DEFAULT (unixepoch()),
    is_self BOOLEAN DEFAULT 0,
    is_video BOOLEAN DEFAULT 0,
    over_18 BOOLEAN DEFAULT 0,
    locked BOOLEAN DEFAULT 0,
    stickied BOOLEAN DEFAULT 0,
    crawl_timestamp INTEGER DEFAULT (unixepoch()),
    crawl_date TEXT GENERATED ALWAYS AS (date(crawl_timestamp, 'unixepoch')) STORED, -- 自动生成爬取日期
    crawl_source TEXT DEFAULT 'auto',
    api_version TEXT DEFAULT 'v1',
    
    -- 确保同一个帖子每天只记录一次
    UNIQUE(id, crawl_date)
);

-- 1.2 关键词表
CREATE TABLE reddit_post_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    category TEXT,
    confidence_score REAL DEFAULT 0,
    extraction_method TEXT DEFAULT 'tfidf',
    keyword_type TEXT DEFAULT 'general',
    frequency INTEGER DEFAULT 1,
    position TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (post_id) REFERENCES reddit_ai_posts(id) ON DELETE CASCADE
);

-- 1.3 技术分类表
CREATE TABLE reddit_post_tech_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,
    primary_category TEXT NOT NULL,
    secondary_categories TEXT,
    confidence_score REAL DEFAULT 0,
    classification_model TEXT DEFAULT 'rule_based',
    tech_stack TEXT,
    application_domain TEXT,
    complexity_level TEXT DEFAULT 'medium',
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (post_id) REFERENCES reddit_ai_posts(id) ON DELETE CASCADE
);

-- 1.4 技术信息提取表
CREATE TABLE reddit_technical_extractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,
    extraction_type TEXT NOT NULL,
    extracted_value TEXT NOT NULL,
    context_text TEXT,
    confidence_score REAL DEFAULT 0,
    validation_status TEXT DEFAULT 'pending',
    extracted_by TEXT DEFAULT 'auto',
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (post_id) REFERENCES reddit_ai_posts(id) ON DELETE CASCADE
);

-- 1.5 趋势分析表
CREATE TABLE reddit_trend_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    keyword TEXT NOT NULL,
    category TEXT,
    frequency INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    avg_quality REAL DEFAULT 0,
    trend_score REAL DEFAULT 0,
    growth_rate REAL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(date, keyword, category)
);

-- 1.6 采集日志表
CREATE TABLE reddit_crawl_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crawl_session_id TEXT NOT NULL,
    subreddit TEXT NOT NULL,
    sort_method TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    total_fetched INTEGER DEFAULT 0,
    total_processed INTEGER DEFAULT 0,
    total_stored INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',
    error_message TEXT,
    api_calls_used INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
);

-- 1.7 系统配置表
CREATE TABLE reddit_system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    config_type TEXT DEFAULT 'string',
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

-- 1.8 API使用统计表
CREATE TABLE reddit_api_usage_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    hour INTEGER NOT NULL,
    api_type TEXT NOT NULL,
    calls_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_response_time REAL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(date, hour, api_type)
);

-- 1.9 每日采集任务表
CREATE TABLE reddit_daily_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_date TEXT NOT NULL UNIQUE,           -- 任务日期 (YYYY-MM-DD)
    target_count INTEGER DEFAULT 200,        -- 目标采集数量
    actual_count INTEGER DEFAULT 0,          -- 实际采集数量
    task_status TEXT DEFAULT 'pending',      -- 任务状态: pending/running/completed/failed
    start_time INTEGER,                      -- 开始时间戳
    end_time INTEGER,                        -- 结束时间戳
    beijing_time TEXT,                       -- 北京时间 (HH:MM)
    error_message TEXT,                      -- 错误信息
    subreddits_processed TEXT,               -- 已处理的子版块 (JSON数组)
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

-- ============================================
-- 第二步: 创建索引
-- ============================================

-- 主表索引
CREATE INDEX idx_posts_subreddit ON reddit_ai_posts(subreddit);
CREATE INDEX idx_posts_created_utc ON reddit_ai_posts(created_utc DESC);
CREATE INDEX idx_posts_score ON reddit_ai_posts(score DESC);
CREATE INDEX idx_posts_quality_score ON reddit_ai_posts(quality_score DESC);
CREATE INDEX idx_posts_category ON reddit_ai_posts(ai_category);
CREATE INDEX idx_posts_processed_at ON reddit_ai_posts(processed_at DESC);
CREATE INDEX idx_posts_extraction_status ON reddit_ai_posts(extraction_status);
CREATE INDEX idx_posts_crawl_date ON reddit_ai_posts(date(crawl_timestamp, 'unixepoch'));

-- 关键词表索引
CREATE INDEX idx_keywords_post_id ON reddit_post_keywords(post_id);
CREATE INDEX idx_keywords_keyword ON reddit_post_keywords(keyword);
CREATE INDEX idx_keywords_category ON reddit_post_keywords(category);
CREATE INDEX idx_keywords_confidence ON reddit_post_keywords(confidence_score DESC);

-- 分类表索引
CREATE INDEX idx_categories_post_id ON reddit_post_tech_categories(post_id);
CREATE INDEX idx_categories_primary ON reddit_post_tech_categories(primary_category);
CREATE INDEX idx_categories_confidence ON reddit_post_tech_categories(confidence_score DESC);

-- 技术提取表索引
CREATE INDEX idx_extractions_post_id ON reddit_technical_extractions(post_id);
CREATE INDEX idx_extractions_type ON reddit_technical_extractions(extraction_type);
CREATE INDEX idx_extractions_status ON reddit_technical_extractions(validation_status);

-- 趋势分析表索引
CREATE INDEX idx_trends_date ON reddit_trend_analysis(date DESC);
CREATE INDEX idx_trends_keyword ON reddit_trend_analysis(keyword);
CREATE INDEX idx_trends_score ON reddit_trend_analysis(trend_score DESC);

-- 日志表索引
CREATE INDEX idx_logs_session ON reddit_crawl_logs(crawl_session_id);
CREATE INDEX idx_logs_subreddit ON reddit_crawl_logs(subreddit);
CREATE INDEX idx_logs_start_time ON reddit_crawl_logs(start_time DESC);

-- 统计表索引
CREATE INDEX idx_stats_date_hour ON reddit_api_usage_stats(date, hour);
CREATE INDEX idx_stats_api_type ON reddit_api_usage_stats(api_type);

-- 每日任务表索引
CREATE INDEX idx_daily_tasks_date ON reddit_daily_tasks(task_date DESC);
CREATE INDEX idx_daily_tasks_status ON reddit_daily_tasks(task_status);
CREATE INDEX idx_daily_tasks_start_time ON reddit_daily_tasks(start_time DESC);

-- ============================================
-- 第三步: 插入配置数据
-- ============================================

INSERT INTO reddit_system_config (config_key, config_value, config_type, description) VALUES
('daily_target_posts', '200', 'integer', '每日目标帖子数量'),
('crawl_time_beijing', '06:00', 'string', '北京时间每日采集时间'),
('crawl_frequency', 'daily', 'string', '采集频率:每日一次'),
('min_quality_score', '30', 'integer', '最低质量分数阈值'),
('enable_daily_dedup', 'true', 'boolean', '启用按日去重功能'),
('api_rate_limit', '600', 'integer', 'API速率限制(每10分钟)'),
('auto_keyword_extraction', 'true', 'boolean', '是否自动提取关键词'),
('target_subreddits', '["MachineLearning", "artificial", "deeplearning", "LocalLLaMA", "ChatGPT", "computervision", "NLP", "MLPapers", "StableDiffusion", "singularity", "agi", "neuralnetworks", "datasets", "voiceai", "MediaSynthesis", "GPT3"]', 'json', '目标子版块列表'),
('ai_categories', '["LLM", "CV", "NLP", "ML", "Robotics", "AGI", "GenerativeAI", "ReinforcementLearning"]', 'json', 'AI技术分类列表'),
('last_crawl_timestamp', '0', 'integer', '最后爬取时间戳'),
('db_schema_version', '2.0', 'string', '数据库架构版本'),
('db_created_at', cast(unixepoch() as text), 'string', '数据库创建时间'),
('db_description', 'Reddit AI Content Acquisition System Database', 'string', '数据库描述');

-- ============================================
-- 第四步: 创建视图 (可选，某些 D1 版本可能不支持)
-- ============================================

-- 注意: 如果创建视图时出错，可以跳过这一步，在应用层实现相同功能

-- 高质量帖子视图
-- CREATE VIEW high_quality_posts AS
-- SELECT 
--     p.*,
--     COUNT(k.id) as keyword_count,
--     tc.primary_category,
--     tc.confidence_score as category_confidence
-- FROM reddit_ai_posts p
-- LEFT JOIN post_keywords k ON p.id = k.post_id
-- LEFT JOIN post_tech_categories tc ON p.id = tc.post_id
-- WHERE p.quality_score >= 50
-- GROUP BY p.id
-- ORDER BY p.quality_score DESC, p.created_utc DESC;

-- ============================================
-- 验证安装
-- ============================================

-- 检查表是否创建成功
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- 检查配置是否插入成功
SELECT config_key, config_value FROM reddit_system_config ORDER BY config_key;

-- 测试插入数据 (可选)
-- INSERT INTO reddit_ai_posts (id, title, subreddit, created_utc, score, quality_score) 
-- VALUES ('test_001', 'Test Post', 'MachineLearning', unixepoch(), 100, 75);

-- 检查测试数据
-- SELECT * FROM reddit_ai_posts WHERE id = 'test_001';

-- 检查每日采集情况
-- SELECT crawl_date, COUNT(*) as post_count 
-- FROM reddit_ai_posts 
-- GROUP BY crawl_date 
-- ORDER BY crawl_date DESC;

-- 检查每日任务执行情况
-- SELECT task_date, target_count, actual_count, task_status, beijing_time
-- FROM reddit_daily_tasks 
-- ORDER BY task_date DESC;

-- 检查去重效果 (每日同一帖子是否只有一条记录)
-- SELECT id, COUNT(*) as duplicate_count, GROUP_CONCAT(crawl_date) as dates
-- FROM reddit_ai_posts 
-- GROUP BY id 
-- HAVING COUNT(*) > 1;

-- 清理测试数据 (如果插入了测试数据)
-- DELETE FROM reddit_ai_posts WHERE id = 'test_001';
