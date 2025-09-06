-- 第二批：创建关键词和分类表
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
