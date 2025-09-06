#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reddit AI 内容采集系统配置文件
"""

import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# ============================================
# Reddit API 配置
# ============================================
REDDIT_CONFIG = {
    "client_id": os.getenv("REDDIT_CLIENT_ID"),
    "client_secret": os.getenv("REDDIT_CLIENT_SECRET"), 
    "user_agent": os.getenv("REDDIT_USER_AGENT", "Reddit_AI_Daily_Collector_v1.0")
}

# ============================================
# Cloudflare D1 数据库配置
# ============================================
DATABASE_CONFIG = {
    "api_token": os.getenv("CLOUDFLARE_API_TOKEN"),
    "account_id": os.getenv("CLOUDFLARE_ACCOUNT_ID"),
    "database_id": os.getenv("D1_DATABASE_ID")
}

# ============================================
# 采集配置
# ============================================
COLLECTION_CONFIG = {
    "daily_target": int(os.getenv("DAILY_TARGET_POSTS", 200)),
    "collection_hour": int(os.getenv("COLLECTION_HOUR", 6)),
    "timezone": os.getenv("COLLECTION_TIMEZONE", "Asia/Shanghai"),
    "enable_dedup": os.getenv("ENABLE_DAILY_DEDUP", "true").lower() == "true",
    "max_retries": int(os.getenv("MAX_RETRIES", 3)),
    "retry_interval": int(os.getenv("RETRY_INTERVAL", 300))
}

# ============================================
# 系统配置
# ============================================
SYSTEM_CONFIG = {
    "debug_mode": os.getenv("DEBUG_MODE", "false").lower() == "true",
    "log_level": os.getenv("LOG_LEVEL", "INFO"),
    "enable_console": os.getenv("ENABLE_CONSOLE_OUTPUT", "true").lower() == "true"
}

# 验证必要配置
def validate_config():
    """验证必要的配置是否存在"""
    required_configs = [
        ("REDDIT_CLIENT_ID", REDDIT_CONFIG["client_id"]),
        ("REDDIT_CLIENT_SECRET", REDDIT_CONFIG["client_secret"]),
        ("CLOUDFLARE_API_TOKEN", DATABASE_CONFIG["api_token"]),
        ("CLOUDFLARE_ACCOUNT_ID", DATABASE_CONFIG["account_id"]),
        ("D1_DATABASE_ID", DATABASE_CONFIG["database_id"])
    ]
    
    missing_configs = []
    for name, value in required_configs:
        if not value:
            missing_configs.append(name)
    
    if missing_configs:
        raise ValueError(f"缺少必要的环境变量: {', '.join(missing_configs)}")
    
    return True

if __name__ == "__main__":
    try:
        validate_config()
        print("✅ 配置验证通过")
        print(f"每日目标帖子数: {COLLECTION_CONFIG['daily_target']}")
        print(f"采集时间: {COLLECTION_CONFIG['collection_hour']}:00 ({COLLECTION_CONFIG['timezone']})")
    except ValueError as e:
        print(f"❌ 配置验证失败: {e}")
        print("请检查 .env 文件中的配置")
