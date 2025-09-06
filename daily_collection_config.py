#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reddit AI 内容每日采集配置
每日北京时间早上6点执行一次采集任务，获取200条AI相关帖子
确保每日内容不重复
"""

import pytz
from datetime import datetime, time

# ============================================
# 采集时间配置
# ============================================

# 北京时区
BEIJING_TZ = pytz.timezone('Asia/Shanghai')

# 每日采集时间 (北京时间早上6点)
DAILY_COLLECTION_TIME = time(6, 0, 0)  # 06:00:00

# 采集配置
COLLECTION_CONFIG = {
    "daily_target": 200,           # 每日目标帖子数量
    "collection_frequency": "daily", # 采集频率：每日一次
    "timezone": "Asia/Shanghai",    # 时区
    "collection_hour": 6,          # 采集小时 (北京时间)
    "collection_minute": 0,        # 采集分钟
    "enable_deduplication": True,   # 启用每日去重
    "max_retries": 3,              # 最大重试次数
    "retry_interval": 300,         # 重试间隔(秒)
}

# ============================================
# 目标子版块配置 (全局检索)
# ============================================

TARGET_SUBREDDITS = [
    # 一级核心社区 (基于实际表现调整)
    {
        "name": "ChatGPT",  # 表现最好，增加配额
        "weight": 1.0,
        "min_score": 30,  # 降低门槛，增加采集量
        "min_comments": 5,
        "target_posts": 45,  # 调整为45
        "sort_methods": ["hot", "top"]
    },
    {
        "name": "LocalLLaMA",  # 表现良好，稍微增加
        "weight": 0.9,
        "min_score": 30,  # 降低门槛
        "min_comments": 5,
        "target_posts": 30,  # 调整为30
        "sort_methods": ["hot", "rising"]
    },
    {
        "name": "StableDiffusion",  # 表现不错，增加配额
        "weight": 0.8,
        "min_score": 20,  # 降低门槛
        "min_comments": 3,
        "target_posts": 20,  # 调整为20
        "sort_methods": ["hot", "top"]
    },
    {
        "name": "singularity",  # 表现良好，增加配额
        "weight": 0.8,
        "min_score": 15,  # 降低门槛
        "min_comments": 3,
        "target_posts": 15,  # 调整为15
        "sort_methods": ["hot", "top"]
    },
    {
        "name": "artificial",  # 进一步降低门槛
        "weight": 0.7,
        "min_score": 15,  # 从30进一步降到15
        "min_comments": 2,  # 从5降到2
        "target_posts": 20,
        "sort_methods": ["hot", "top", "new"]  # 增加new排序
    },
    
    # 二级专业社区 (优化配置)
    {
        "name": "MachineLearning",  # 进一步降低门槛
        "weight": 0.7,
        "min_score": 10,  # 从25进一步降到10
        "min_comments": 1,  # 从3降到1
        "target_posts": 12,
        "sort_methods": ["hot", "top", "new"]  # 增加new排序
    },
    {
        "name": "deeplearning",  # 进一步降低门槛
        "weight": 0.7,
        "min_score": 8,  # 从20进一步降到8
        "min_comments": 1,  # 从3降到1
        "target_posts": 12,
        "sort_methods": ["hot", "top", "new", "rising"]  # 增加更多排序
    },
    {
        "name": "computervision",
        "weight": 0.6,
        "min_score": 15,  # 降低门槛
        "min_comments": 2,
        "target_posts": 8,
        "sort_methods": ["hot", "top"]
    },
    {
        "name": "NLP",
        "weight": 0.6,
        "min_score": 5,  # 进一步降低门槛
        "min_comments": 1,
        "target_posts": 8,
        "sort_methods": ["hot", "top", "new"]  # 增加new排序
    },
    {
        "name": "MLPapers",
        "weight": 0.6,
        "min_score": 3,  # 进一步降低门槛
        "min_comments": 1,
        "target_posts": 8,
        "sort_methods": ["hot", "new", "rising"]  # 增加rising排序
    },
    
    # 三级前沿社区 (优化配置)
    {
        "name": "agi",
        "weight": 0.5,
        "min_score": 10,  # 降低门槛
        "min_comments": 2,
        "target_posts": 6,
        "sort_methods": ["hot", "top"]
    },
    {
        "name": "neuralnetworks",
        "weight": 0.5,
        "min_score": 3,  # 进一步降低
        "min_comments": 1,
        "target_posts": 3,
        "sort_methods": ["hot", "new", "rising"]  # 增加排序
    },
    {
        "name": "datasets",
        "weight": 0.4,
        "min_score": 2,  # 进一步降低
        "min_comments": 1,
        "target_posts": 4,
        "sort_methods": ["hot", "new", "rising"]  # 增加排序
    },
    {
        "name": "voiceai",
        "weight": 0.4,
        "min_score": 2,  # 进一步降低
        "min_comments": 1,
        "target_posts": 4,
        "sort_methods": ["hot", "top", "new"]  # 增加排序
    },
    {
        "name": "MediaSynthesis",
        "weight": 0.4,
        "min_score": 2,  # 进一步降低
        "min_comments": 1,
        "target_posts": 2,
        "sort_methods": ["hot", "new", "rising"]  # 增加排序
    },
    {
        "name": "GPT3",
        "weight": 0.5,
        "min_score": 3,  # 进一步降低
        "min_comments": 1,
        "target_posts": 3,
        "sort_methods": ["hot", "top", "new"]  # 增加排序
    }
]

# 验证目标帖子数量总和是否等于200
total_target = sum(subreddit["target_posts"] for subreddit in TARGET_SUBREDDITS)
assert total_target == 200, f"目标帖子总数不等于200，当前为: {total_target}"

# ============================================
# AI相关关键词过滤
# ============================================

AI_KEYWORDS = {
    "核心技术": [
        "machine learning", "deep learning", "neural network", "artificial intelligence",
        "transformer", "attention", "llm", "large language model", "gpt", "bert", 
        "diffusion", "stable diffusion", "computer vision", "nlp", "natural language processing",
        "reinforcement learning", "supervised learning", "unsupervised learning", "ai", "ml", "dl"
    ],
    
    "模型架构": [
        "cnn", "rnn", "lstm", "gru", "gan", "vae", "autoencoder", "resnet", "vit",
        "vision transformer", "multimodal", "cross-modal", "foundation model", "neural", "network"
    ],
    
    "应用领域": [
        "autonomous driving", "robotics", "healthcare ai", "medical ai", "fintech",
        "generative ai", "conversational ai", "chatbot", "voice assistant", "tts",
        "speech recognition", "image generation", "text generation", "code generation",
        "automation", "intelligent", "smart", "predict", "classification", "recognition"
    ],
    
    "工具框架": [
        "pytorch", "tensorflow", "jax", "hugging face", "transformers", "langchain",
        "llamaindex", "openai", "anthropic", "claude", "gemini", "mistral",
        "scikit-learn", "keras", "fastai", "wandb", "mlflow", "jupyter", "python", "model"
    ],
    
    "前沿概念": [
        "agi", "artificial general intelligence", "few-shot", "zero-shot", "in-context learning",
        "prompt engineering", "fine-tuning", "lora", "qlora", "rag", "retrieval augmented",
        "multiagent", "agent", "reasoning", "chain of thought", "emergent abilities",
        "algorithm", "data science", "analytics", "optimization"
    ],
    
    "边缘相关": [
        "tech", "technology", "innovation", "algorithm", "data", "dataset", "training",
        "inference", "prediction", "analysis", "computing", "gpu", "cloud", "api"
    ]
}

# ============================================
# 质量评估配置
# ============================================

QUALITY_FILTERS = {
    "min_title_length": 10,        # 标题最小长度
    "max_title_length": 300,       # 标题最大长度
    "min_content_length": 50,      # 内容最小长度
    "min_upvote_ratio": 0.6,       # 最小点赞比例
    "exclude_nsfw": True,          # 排除NSFW内容
    "exclude_deleted": True,       # 排除已删除内容
    "exclude_removed": True,       # 排除已移除内容
}

# ============================================
# 每日任务管理配置
# ============================================

DAILY_TASK_CONFIG = {
    "auto_create_task": True,      # 自动创建每日任务
    "task_timeout_hours": 2,       # 任务超时时间(小时)
    "status_check_interval": 60,   # 状态检查间隔(秒)
    "progress_report_interval": 20, # 进度报告间隔(每20个帖子)
    "enable_task_recovery": True,   # 启用任务恢复
    "max_task_duration": 7200,     # 最大任务时长(秒)
}

# ============================================
# 数据库配置
# ============================================

DATABASE_CONFIG = {
    "enable_daily_dedup": True,    # 启用每日去重
    "dedup_method": "unique_constraint",  # 去重方法
    "batch_insert_size": 50,       # 批量插入大小
    "connection_timeout": 30,      # 连接超时时间
    "retry_on_conflict": True,     # 冲突时重试
}

# ============================================
# 工具函数
# ============================================

def get_next_collection_time():
    """获取下一次采集时间 (北京时间)"""
    now = datetime.now(BEIJING_TZ)
    next_collection = now.replace(
        hour=DAILY_COLLECTION_TIME.hour,
        minute=DAILY_COLLECTION_TIME.minute,
        second=DAILY_COLLECTION_TIME.second,
        microsecond=0
    )
    
    # 如果今天的采集时间已过，则设为明天
    if next_collection <= now:
        next_collection = next_collection.replace(day=next_collection.day + 1)
    
    return next_collection

def get_collection_date(timestamp=None):
    """获取采集日期 (YYYY-MM-DD格式)"""
    if timestamp:
        dt = datetime.fromtimestamp(timestamp, BEIJING_TZ)
    else:
        dt = datetime.now(BEIJING_TZ)
    return dt.strftime('%Y-%m-%d')

def is_ai_related_content(title, content=""):
    """检查内容是否与AI相关"""
    text = (title + " " + content).lower()
    
    # 检查是否包含AI关键词
    for category, keywords in AI_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in text:
                return True, category, keyword
    
    return False, None, None

def calculate_subreddit_priority(subreddit_config, current_time):
    """计算子版块采集优先级"""
    base_priority = subreddit_config["weight"]
    
    # 根据目标帖子数量调整优先级
    target_posts = subreddit_config["target_posts"]
    if target_posts >= 30:
        priority_boost = 0.2
    elif target_posts >= 15:
        priority_boost = 0.1
    else:
        priority_boost = 0.0
    
    return base_priority + priority_boost

def get_today_target_by_subreddit():
    """获取今日各子版块的目标帖子数"""
    return {sub["name"]: sub["target_posts"] for sub in TARGET_SUBREDDITS}

if __name__ == "__main__":
    print("Reddit AI 内容每日采集配置")
    print("=" * 50)
    print(f"每日目标帖子数: {COLLECTION_CONFIG['daily_target']}")
    print(f"采集时间: 北京时间每日 {DAILY_COLLECTION_TIME}")
    print(f"目标子版块数量: {len(TARGET_SUBREDDITS)}")
    print(f"总目标帖子数验证: {total_target}")
    print("\n下一次采集时间:", get_next_collection_time())
    print("今日采集日期:", get_collection_date())
    
    print("\n各子版块目标帖子数分配:")
    for sub in TARGET_SUBREDDITS:
        print(f"  r/{sub['name']}: {sub['target_posts']} 帖子")
