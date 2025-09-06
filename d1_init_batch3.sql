-- 第三批：创建系统管理表
CREATE TABLE reddit_daily_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_date TEXT NOT NULL UNIQUE,
    target_count INTEGER DEFAULT 200,
    actual_count INTEGER DEFAULT 0,
    task_status TEXT DEFAULT 'pending',
    start_time INTEGER,
    end_time INTEGER,
    beijing_time TEXT,
    error_message TEXT,
    subreddits_processed TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

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
