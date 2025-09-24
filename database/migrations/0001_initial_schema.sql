-- Reddit AI Crawler 初始数据库架构
-- 创建时间: 2024-09-24

-- 主帖子表
CREATE TABLE IF NOT EXISTS redditV2_posts (
    -- 基础信息
    id TEXT PRIMARY KEY,                    -- Reddit帖子ID
    subreddit TEXT NOT NULL,               -- 社区名称
    title TEXT NOT NULL,                   -- 帖子标题
    selftext TEXT,                         -- 帖子正文内容
    url TEXT,                              -- 原始链接(可能是图片/视频/外部链接)
    post_url TEXT,                         -- 标准Reddit帖子链接
    
    -- 时间信息
    created_utc INTEGER NOT NULL,          -- 帖子创建时间(UTC时间戳)
    collected_at INTEGER NOT NULL,         -- 数据采集时间(UTC时间戳)
    collection_date TEXT NOT NULL,         -- 采集日期(YYYY-MM-DD)
    collection_batch_id TEXT,              -- 采集批次ID
    
    -- 作者信息
    author TEXT,                           -- 发帖人
    
    -- 互动数据
    score INTEGER NOT NULL DEFAULT 0,      -- 净点赞数
    num_comments INTEGER NOT NULL DEFAULT 0, -- 评论总数
    upvote_ratio REAL DEFAULT 0.0,         -- 点赞率
    ups INTEGER DEFAULT 0,                 -- 点赞数
    downs INTEGER DEFAULT 0,               -- 踩数
    
    -- 内容分类
    flair TEXT,                            -- 帖子标签
    awards TEXT,                           -- 奖励信息(JSON)
    is_self BOOLEAN DEFAULT FALSE,         -- 是否为文本帖
    is_video BOOLEAN DEFAULT FALSE,        -- 是否为视频帖
    
    -- AI相关性
    ai_relevance_score REAL DEFAULT 0.0,   -- AI相关性评分
    is_ai_related BOOLEAN DEFAULT TRUE,    -- 是否AI相关
    
    -- 审计字段
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 社区配置表
CREATE TABLE IF NOT EXISTS redditV2_subreddit_configs (
    subreddit_name TEXT PRIMARY KEY,       -- 社区名称
    is_active BOOLEAN DEFAULT TRUE,        -- 是否启用
    priority INTEGER DEFAULT 1,            -- 优先级(1-5)
    daily_quota INTEGER DEFAULT 50,        -- 每日配额
    min_score INTEGER DEFAULT 10,          -- 最小点赞数阈值
    min_comments INTEGER DEFAULT 5,        -- 最小评论数阈值
    min_upvote_ratio REAL DEFAULT 0.1,     -- 最小点赞率阈值
    weight_multiplier REAL DEFAULT 1.0,    -- 权重倍数
    last_crawled INTEGER,                  -- 最后爬取时间
    total_collected INTEGER DEFAULT 0,     -- 总采集数量
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 采集统计表
CREATE TABLE IF NOT EXISTS redditV2_collection_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_date TEXT NOT NULL,         -- 采集日期
    collection_batch_id TEXT NOT NULL,     -- 批次ID
    subreddit TEXT NOT NULL,               -- 社区名称
    total_fetched INTEGER DEFAULT 0,       -- 总获取数
    total_filtered INTEGER DEFAULT 0,      -- 过滤后数量
    total_saved INTEGER DEFAULT 0,         -- 成功保存数量
    start_time INTEGER NOT NULL,           -- 开始时间
    end_time INTEGER,                      -- 结束时间
    duration_seconds INTEGER,              -- 耗时(秒)
    status TEXT DEFAULT 'completed',       -- 状态
    error_message TEXT,                    -- 错误信息
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 每日汇总表
CREATE TABLE IF NOT EXISTS redditV2_daily_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    summary_date TEXT NOT NULL UNIQUE,     -- 汇总日期
    total_posts INTEGER DEFAULT 0,         -- 总帖子数
    total_subreddits INTEGER DEFAULT 0,    -- 总社区数
    ai_related_posts INTEGER DEFAULT 0,    -- AI相关帖子数
    avg_score REAL DEFAULT 0.0,           -- 平均点赞数
    avg_comments REAL DEFAULT 0.0,        -- 平均评论数
    top_subreddit TEXT,                    -- 最活跃社区
    total_batches INTEGER DEFAULT 0,       -- 总批次数
    successful_batches INTEGER DEFAULT 0,  -- 成功批次数
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 错误日志表
CREATE TABLE IF NOT EXISTS redditV2_error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    error_type TEXT NOT NULL,              -- 错误类型
    error_message TEXT NOT NULL,           -- 错误消息
    subreddit TEXT,                        -- 相关社区
    collection_batch_id TEXT,              -- 采集批次ID
    severity TEXT DEFAULT 'error',         -- 严重程度
    resolved BOOLEAN DEFAULT FALSE,        -- 是否已解决
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 插入默认的社区配置
INSERT OR REPLACE INTO subreddit_configs (
    subreddit_name, is_active, priority, daily_quota, min_score, min_comments, min_upvote_ratio
) VALUES
-- Tier 1 - 高优先级社区
('MachineLearning', TRUE, 1, 100, 15, 8, 0.1),
('artificial', TRUE, 1, 80, 15, 8, 0.1),
('deeplearning', TRUE, 1, 80, 15, 8, 0.1),
('LocalLLaMA', TRUE, 1, 70, 15, 8, 0.1),
('ChatGPT', TRUE, 1, 70, 15, 8, 0.1),

-- Tier 2 - 中等优先级社区
('OpenAI', TRUE, 2, 60, 10, 5, 0.1),
('computervision', TRUE, 2, 60, 10, 5, 0.1),
('NLP', TRUE, 2, 60, 10, 5, 0.1),
('MLPapers', TRUE, 2, 50, 10, 5, 0.1),
('StableDiffusion', TRUE, 2, 50, 10, 5, 0.1),
('ArtificialInteligence', TRUE, 2, 50, 10, 5, 0.1),
('singularity', TRUE, 2, 50, 10, 5, 0.1),
('AI_Agents', TRUE, 2, 50, 10, 5, 0.1),

-- Tier 3 - 标准优先级社区
('agi', TRUE, 3, 40, 8, 3, 0.1),
('neuralnetworks', TRUE, 3, 40, 8, 3, 0.1),
('datasets', TRUE, 3, 30, 8, 3, 0.1),
('voiceai', TRUE, 3, 30, 8, 3, 0.1),
('MediaSynthesis', TRUE, 3, 30, 8, 3, 0.1),
('GPT3', TRUE, 3, 30, 8, 3, 0.1),
('grok', TRUE, 3, 30, 8, 3, 0.1),
('ClaudeAI', TRUE, 3, 30, 8, 3, 0.1),
('aivideo', TRUE, 3, 25, 8, 3, 0.1),
('IndianArtAI', TRUE, 3, 25, 8, 3, 0.1),
('gameai', TRUE, 3, 25, 8, 3, 0.1),
('GoogleGeminiAI', TRUE, 3, 25, 8, 3, 0.1),
('NovelAi', TRUE, 3, 25, 8, 3, 0.1),
('KindroidAI', TRUE, 3, 20, 8, 3, 0.1),
('WritingWithAI', TRUE, 3, 20, 8, 3, 0.1),
('Qwen_AI', TRUE, 3, 20, 8, 3, 0.1);