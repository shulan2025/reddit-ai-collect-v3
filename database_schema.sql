-- Reddit AI 内容获取系统数据表设计
-- 适用于 Cloudflare D1 数据库
-- 创建时间: 2025-01-01

-- ============================================
-- 1. 主帖子表 (reddit_ai_posts)
-- ============================================
CREATE TABLE IF NOT EXISTS reddit_ai_posts (
    -- 唯一标识
    id TEXT PRIMARY KEY,                        -- Reddit帖子ID
    permalink TEXT NOT NULL,                    -- Reddit永久链接
    url TEXT,                                   -- 外部链接URL
    
    -- 内容主体
    title TEXT NOT NULL,                        -- 帖子标题
    selftext TEXT,                              -- 帖子正文
    selftext_html TEXT,                         -- HTML格式正文
    
    -- 热度与价值指标
    score INTEGER DEFAULT 0,                    -- 得分(点赞-点踩)
    upvote_ratio REAL DEFAULT 0,               -- 点赞比例(0-1)
    num_comments INTEGER DEFAULT 0,            -- 评论数量
    total_awards_received INTEGER DEFAULT 0,   -- 获得奖励数
    num_crossposts INTEGER DEFAULT 0,          -- 转发数量
    
    -- 背景信息
    author TEXT,                               -- 作者用户名
    subreddit TEXT NOT NULL,                   -- 所属子版块
    subreddit_subscribers INTEGER,             -- 子版块订阅者数
    created_utc INTEGER NOT NULL,              -- 创建时间(Unix时间戳)
    
    -- 质量评估
    quality_score REAL DEFAULT 0,             -- 综合质量评分(0-100)
    content_category TEXT,                     -- 内容分类
    tech_relevance_score REAL DEFAULT 0,      -- 技术相关性评分(0-10)
    ai_category TEXT,                          -- AI技术分类
    
    -- 处理状态
    processed_at INTEGER DEFAULT (unixepoch()), -- 处理时间戳
    extraction_status TEXT DEFAULT 'pending',   -- 提取状态: pending/processing/completed/failed
    last_updated INTEGER DEFAULT (unixepoch()), -- 最后更新时间
    
    -- 额外元数据
    is_self BOOLEAN DEFAULT 0,                 -- 是否为自发帖
    is_video BOOLEAN DEFAULT 0,                -- 是否包含视频
    over_18 BOOLEAN DEFAULT 0,                 -- 是否NSFW内容
    locked BOOLEAN DEFAULT 0,                  -- 是否被锁定
    stickied BOOLEAN DEFAULT 0,                -- 是否置顶
    
    -- 数据来源信息
    crawl_timestamp INTEGER DEFAULT (unixepoch()), -- 爬取时间戳
    crawl_source TEXT DEFAULT 'auto',              -- 爬取来源
    api_version TEXT DEFAULT 'v1'                  -- API版本
);

-- ============================================
-- 2. 关键词提取表 (post_keywords)
-- ============================================
CREATE TABLE IF NOT EXISTS post_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,                     -- 关联帖子ID
    keyword TEXT NOT NULL,                     -- 提取的关键词
    category TEXT,                             -- 关键词分类
    confidence_score REAL DEFAULT 0,          -- 置信度评分(0-1)
    extraction_method TEXT DEFAULT 'tfidf',   -- 提取方法: tfidf/bert/manual/regex
    keyword_type TEXT DEFAULT 'general',      -- 关键词类型: tech/tool/concept/company
    frequency INTEGER DEFAULT 1,              -- 在文本中出现频次
    position TEXT,                             -- 出现位置: title/content/both
    created_at INTEGER DEFAULT (unixepoch()), -- 创建时间
    
    FOREIGN KEY (post_id) REFERENCES reddit_ai_posts(id) ON DELETE CASCADE
);

-- ============================================
-- 3. 技术分类表 (post_tech_categories)
-- ============================================
CREATE TABLE IF NOT EXISTS post_tech_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,                     -- 关联帖子ID
    primary_category TEXT NOT NULL,           -- 主要技术分类
    secondary_categories TEXT,                 -- 次要分类(JSON格式)
    confidence_score REAL DEFAULT 0,          -- 分类置信度(0-1)
    classification_model TEXT DEFAULT 'rule_based', -- 分类模型
    tech_stack TEXT,                           -- 技术栈信息(JSON)
    application_domain TEXT,                   -- 应用领域
    complexity_level TEXT DEFAULT 'medium',   -- 复杂度: low/medium/high/expert
    created_at INTEGER DEFAULT (unixepoch()), -- 创建时间
    
    FOREIGN KEY (post_id) REFERENCES reddit_ai_posts(id) ON DELETE CASCADE
);

-- ============================================
-- 4. 技术信息提取表 (technical_extractions)
-- ============================================
CREATE TABLE IF NOT EXISTS technical_extractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,                     -- 关联帖子ID
    extraction_type TEXT NOT NULL,            -- 提取类型: model/performance/dataset/framework
    extracted_value TEXT NOT NULL,            -- 提取的值
    context_text TEXT,                        -- 上下文文本
    confidence_score REAL DEFAULT 0,          -- 置信度
    validation_status TEXT DEFAULT 'pending', -- 验证状态: pending/validated/rejected
    extracted_by TEXT DEFAULT 'auto',         -- 提取方式: auto/manual
    created_at INTEGER DEFAULT (unixepoch()), -- 创建时间
    
    FOREIGN KEY (post_id) REFERENCES reddit_ai_posts(id) ON DELETE CASCADE
);

-- ============================================
-- 5. 趋势分析表 (trend_analysis)
-- ============================================
CREATE TABLE IF NOT EXISTS trend_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,                        -- 日期 (YYYY-MM-DD)
    keyword TEXT NOT NULL,                     -- 关键词
    category TEXT,                             -- 分类
    frequency INTEGER DEFAULT 0,              -- 当日出现频次
    total_score INTEGER DEFAULT 0,            -- 当日总分数
    avg_quality REAL DEFAULT 0,               -- 平均质量分
    trend_score REAL DEFAULT 0,               -- 趋势分数
    growth_rate REAL DEFAULT 0,               -- 增长率
    created_at INTEGER DEFAULT (unixepoch()), -- 创建时间
    
    UNIQUE(date, keyword, category)
);

-- ============================================
-- 6. 数据采集日志表 (crawl_logs)
-- ============================================
CREATE TABLE IF NOT EXISTS crawl_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crawl_session_id TEXT NOT NULL,           -- 采集会话ID
    subreddit TEXT NOT NULL,                  -- 目标子版块
    sort_method TEXT NOT NULL,                -- 排序方法: hot/rising/new
    start_time INTEGER NOT NULL,             -- 开始时间
    end_time INTEGER,                         -- 结束时间
    total_fetched INTEGER DEFAULT 0,         -- 总获取数
    total_processed INTEGER DEFAULT 0,       -- 总处理数
    total_stored INTEGER DEFAULT 0,          -- 总存储数
    status TEXT DEFAULT 'running',           -- 状态: running/completed/failed
    error_message TEXT,                       -- 错误信息
    api_calls_used INTEGER DEFAULT 0,        -- API调用次数
    created_at INTEGER DEFAULT (unixepoch()) -- 创建时间
);

-- ============================================
-- 7. 系统配置表 (system_config)
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,          -- 配置键
    config_value TEXT NOT NULL,               -- 配置值
    config_type TEXT DEFAULT 'string',       -- 值类型: string/integer/boolean/json
    description TEXT,                         -- 配置描述
    is_active BOOLEAN DEFAULT 1,             -- 是否激活
    created_at INTEGER DEFAULT (unixepoch()), -- 创建时间
    updated_at INTEGER DEFAULT (unixepoch())  -- 更新时间
);

-- ============================================
-- 8. API使用统计表 (api_usage_stats)
-- ============================================
CREATE TABLE IF NOT EXISTS api_usage_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,                       -- 日期 (YYYY-MM-DD)
    hour INTEGER NOT NULL,                    -- 小时 (0-23)
    api_type TEXT NOT NULL,                   -- API类型: reddit/openai/other
    calls_count INTEGER DEFAULT 0,           -- 调用次数
    success_count INTEGER DEFAULT 0,         -- 成功次数
    error_count INTEGER DEFAULT 0,           -- 错误次数
    avg_response_time REAL DEFAULT 0,        -- 平均响应时间(ms)
    created_at INTEGER DEFAULT (unixepoch()), -- 创建时间
    
    UNIQUE(date, hour, api_type)
);

-- ============================================
-- 创建索引以优化查询性能
-- ============================================

-- 主表索引
CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON reddit_ai_posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_posts_created_utc ON reddit_ai_posts(created_utc DESC);
CREATE INDEX IF NOT EXISTS idx_posts_score ON reddit_ai_posts(score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_quality_score ON reddit_ai_posts(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON reddit_ai_posts(ai_category);
CREATE INDEX IF NOT EXISTS idx_posts_processed_at ON reddit_ai_posts(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_extraction_status ON reddit_ai_posts(extraction_status);

-- 关键词表索引
CREATE INDEX IF NOT EXISTS idx_keywords_post_id ON post_keywords(post_id);
CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON post_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_keywords_category ON post_keywords(category);
CREATE INDEX IF NOT EXISTS idx_keywords_confidence ON post_keywords(confidence_score DESC);

-- 分类表索引
CREATE INDEX IF NOT EXISTS idx_categories_post_id ON post_tech_categories(post_id);
CREATE INDEX IF NOT EXISTS idx_categories_primary ON post_tech_categories(primary_category);
CREATE INDEX IF NOT EXISTS idx_categories_confidence ON post_tech_categories(confidence_score DESC);

-- 技术提取表索引
CREATE INDEX IF NOT EXISTS idx_extractions_post_id ON technical_extractions(post_id);
CREATE INDEX IF NOT EXISTS idx_extractions_type ON technical_extractions(extraction_type);
CREATE INDEX IF NOT EXISTS idx_extractions_status ON technical_extractions(validation_status);

-- 趋势分析表索引
CREATE INDEX IF NOT EXISTS idx_trends_date ON trend_analysis(date DESC);
CREATE INDEX IF NOT EXISTS idx_trends_keyword ON trend_analysis(keyword);
CREATE INDEX IF NOT EXISTS idx_trends_score ON trend_analysis(trend_score DESC);

-- 日志表索引
CREATE INDEX IF NOT EXISTS idx_logs_session ON crawl_logs(crawl_session_id);
CREATE INDEX IF NOT EXISTS idx_logs_subreddit ON crawl_logs(subreddit);
CREATE INDEX IF NOT EXISTS idx_logs_start_time ON crawl_logs(start_time DESC);

-- 统计表索引
CREATE INDEX IF NOT EXISTS idx_stats_date_hour ON api_usage_stats(date, hour);
CREATE INDEX IF NOT EXISTS idx_stats_api_type ON api_usage_stats(api_type);

-- ============================================
-- 插入默认配置数据
-- ============================================
INSERT OR IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES
('daily_target_posts', '200', 'integer', '每日目标帖子数量'),
('min_quality_score', '30', 'integer', '最低质量分数阈值'),
('crawl_interval_hours', '2', 'integer', '爬取间隔小时数'),
('api_rate_limit', '600', 'integer', 'API速率限制(每10分钟)'),
('auto_keyword_extraction', 'true', 'boolean', '是否自动提取关键词'),
('subreddit_weights', '{"r/MachineLearning": 1.0, "r/artificial": 0.8}', 'json', '子版块权重配置'),
('ai_categories', '["LLM", "CV", "NLP", "ML", "Robotics", "AGI"]', 'json', 'AI技术分类列表'),
('last_crawl_timestamp', '0', 'integer', '最后爬取时间戳');

-- ============================================
-- 视图定义 (便于查询)
-- ============================================

-- 高质量帖子视图
CREATE VIEW IF NOT EXISTS high_quality_posts AS
SELECT 
    p.*,
    COUNT(k.id) as keyword_count,
    tc.primary_category,
    tc.confidence_score as category_confidence
FROM reddit_ai_posts p
LEFT JOIN post_keywords k ON p.id = k.post_id
LEFT JOIN post_tech_categories tc ON p.id = tc.post_id
WHERE p.quality_score >= 50
GROUP BY p.id
ORDER BY p.quality_score DESC, p.created_utc DESC;

-- 每日统计视图
CREATE VIEW IF NOT EXISTS daily_stats AS
SELECT 
    date(created_utc, 'unixepoch') as date,
    subreddit,
    COUNT(*) as post_count,
    AVG(score) as avg_score,
    AVG(quality_score) as avg_quality,
    MAX(score) as max_score,
    SUM(num_comments) as total_comments
FROM reddit_ai_posts
GROUP BY date(created_utc, 'unixepoch'), subreddit
ORDER BY date DESC;

-- 热门关键词视图
CREATE VIEW IF NOT EXISTS trending_keywords AS
SELECT 
    k.keyword,
    k.category,
    COUNT(*) as frequency,
    AVG(p.quality_score) as avg_quality,
    AVG(k.confidence_score) as avg_confidence,
    MAX(p.created_utc) as latest_mention
FROM post_keywords k
JOIN reddit_ai_posts p ON k.post_id = p.id
WHERE p.created_utc > unixepoch() - 86400  -- 最近24小时
GROUP BY k.keyword, k.category
HAVING frequency >= 3
ORDER BY frequency DESC, avg_quality DESC;

-- ============================================
-- 数据库版本信息
-- ============================================
INSERT OR REPLACE INTO system_config (config_key, config_value, config_type, description) VALUES
('db_schema_version', '2.0', 'string', '数据库架构版本'),
('db_created_at', cast(unixepoch() as text), 'string', '数据库创建时间'),
('db_description', 'Reddit AI Content Acquisition System Database', 'string', '数据库描述');
