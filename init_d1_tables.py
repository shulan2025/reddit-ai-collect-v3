#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
通过API初始化Cloudflare D1数据表
"""

import requests
import json
import time

def execute_d1_sql(api_token, account_id, database_id, sql):
    """执行D1 SQL语句"""
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"
    data = {"sql": sql}
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                return True, result.get("result", [])
            else:
                return False, result.get("errors", [])
        else:
            return False, f"HTTP {response.status_code}: {response.text}"
            
    except Exception as e:
        return False, str(e)

def init_reddit_tables():
    """初始化Reddit AI采集系统的数据表"""
    API_TOKEN = "WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU"
    ACCOUNT_ID = "e23dc8a212c55fe9210b99f24be11eb9"
    DATABASE_ID = "3d1a2cff-14ac-49e7-9bfd-b4a5606c9712"
    
    print("🚀 开始初始化Reddit AI数据表...")
    
    # 表创建SQL列表
    tables_sql = [
        # 主表
        """CREATE TABLE IF NOT EXISTS reddit_ai_posts (
            id TEXT PRIMARY KEY,
            permalink TEXT NOT NULL,
            url TEXT,
            title TEXT NOT NULL,
            selftext TEXT,
            score INTEGER DEFAULT 0,
            upvote_ratio REAL DEFAULT 0,
            num_comments INTEGER DEFAULT 0,
            author TEXT,
            subreddit TEXT NOT NULL,
            created_utc INTEGER NOT NULL,
            quality_score REAL DEFAULT 0,
            ai_category TEXT,
            crawl_timestamp INTEGER DEFAULT (unixepoch()),
            crawl_date TEXT GENERATED ALWAYS AS (date(crawl_timestamp, 'unixepoch')) STORED,
            UNIQUE(id, crawl_date)
        )""",
        
        # 关键词表
        """CREATE TABLE IF NOT EXISTS reddit_post_keywords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id TEXT NOT NULL,
            keyword TEXT NOT NULL,
            category TEXT,
            confidence_score REAL DEFAULT 0,
            extraction_method TEXT DEFAULT 'frequency',
            created_at INTEGER DEFAULT (unixepoch()),
            FOREIGN KEY (post_id) REFERENCES reddit_ai_posts(id) ON DELETE CASCADE
        )""",
        
        # 每日任务表
        """CREATE TABLE IF NOT EXISTS reddit_daily_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_date TEXT NOT NULL UNIQUE,
            target_count INTEGER DEFAULT 200,
            actual_count INTEGER DEFAULT 0,
            task_status TEXT DEFAULT 'pending',
            start_time INTEGER,
            end_time INTEGER,
            created_at INTEGER DEFAULT (unixepoch())
        )""",
        
        # 系统配置表
        """CREATE TABLE IF NOT EXISTS reddit_system_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_key TEXT UNIQUE NOT NULL,
            config_value TEXT NOT NULL,
            description TEXT,
            created_at INTEGER DEFAULT (unixepoch())
        )"""
    ]
    
    # 索引创建SQL
    indexes_sql = [
        "CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON reddit_ai_posts(subreddit)",
        "CREATE INDEX IF NOT EXISTS idx_posts_created_utc ON reddit_ai_posts(created_utc DESC)",
        "CREATE INDEX IF NOT EXISTS idx_posts_crawl_date ON reddit_ai_posts(crawl_date DESC)",
        "CREATE INDEX IF NOT EXISTS idx_keywords_post_id ON reddit_post_keywords(post_id)",
        "CREATE INDEX IF NOT EXISTS idx_tasks_date ON reddit_daily_tasks(task_date DESC)"
    ]
    
    # 配置数据SQL
    config_data_sql = """INSERT OR IGNORE INTO reddit_system_config (config_key, config_value, description) VALUES
        ('daily_target_posts', '200', '每日目标帖子数量'),
        ('collection_hour', '6', '采集时间（北京时间）'),
        ('enable_dedup', 'true', '启用每日去重'),
        ('system_version', '1.0', '系统版本')"""
    
    # 执行表创建
    success_count = 0
    total_operations = len(tables_sql) + len(indexes_sql) + 1
    
    print(f"📋 创建 {len(tables_sql)} 个数据表...")
    for i, sql in enumerate(tables_sql, 1):
        table_name = sql.split("TABLE IF NOT EXISTS ")[1].split(" ")[0]
        print(f"  {i}/{len(tables_sql)} 创建表 {table_name}...")
        
        success, result = execute_d1_sql(API_TOKEN, ACCOUNT_ID, DATABASE_ID, sql)
        if success:
            print(f"    ✅ {table_name} 创建成功")
            success_count += 1
        else:
            print(f"    ❌ {table_name} 创建失败: {result}")
        
        time.sleep(1)  # API调用间隔
    
    print(f"\n📇 创建 {len(indexes_sql)} 个索引...")
    for i, sql in enumerate(indexes_sql, 1):
        index_name = sql.split("INDEX IF NOT EXISTS ")[1].split(" ")[0]
        print(f"  {i}/{len(indexes_sql)} 创建索引 {index_name}...")
        
        success, result = execute_d1_sql(API_TOKEN, ACCOUNT_ID, DATABASE_ID, sql)
        if success:
            print(f"    ✅ {index_name} 创建成功")
            success_count += 1
        else:
            print(f"    ❌ {index_name} 创建失败: {result}")
        
        time.sleep(1)
    
    print(f"\n⚙️ 插入配置数据...")
    success, result = execute_d1_sql(API_TOKEN, ACCOUNT_ID, DATABASE_ID, config_data_sql)
    if success:
        print(f"    ✅ 配置数据插入成功")
        success_count += 1
    else:
        print(f"    ❌ 配置数据插入失败: {result}")
    
    # 验证创建结果
    print(f"\n🔍 验证表创建结果...")
    success, result = execute_d1_sql(API_TOKEN, ACCOUNT_ID, DATABASE_ID, 
                                   "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'reddit_%'")
    
    if success and result:
        reddit_tables = [row["name"] for row in result[0].get("results", [])]
        print(f"✅ 发现 {len(reddit_tables)} 个Reddit相关表:")
        for table in reddit_tables:
            print(f"   - {table}")
    
    print(f"\n🎉 初始化完成！成功执行 {success_count}/{total_operations} 个操作")
    return success_count == total_operations

if __name__ == "__main__":
    success = init_reddit_tables()
    exit(0 if success else 1)
