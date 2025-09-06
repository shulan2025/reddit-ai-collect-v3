#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reddit 帖子时间过滤配置
优化采集效果，确保获取有价值的时效性内容
"""

import time
from datetime import datetime, timedelta
import pytz

# ============================================
# 时间过滤配置
# ============================================

BEIJING_TZ = pytz.timezone('Asia/Shanghai')

TIME_FILTER_CONFIG = {
    # 帖子年龄限制
    "max_age_days": 30,          # 最多采集30天内的帖子
    "min_age_hours": 2,          # 至少发布2小时后再采集
    "prefer_recent_hours": 24,   # 优先采集24小时内的帖子
    
    # 时间窗口设置
    "peak_hours": [9, 10, 11, 14, 15, 16, 20, 21, 22],  # 优质内容发布的高峰时段
    "timezone_preference": "UTC",  # Reddit主要使用UTC时间
    
    # 每日采集时间限制
    "collection_start_hour": 6,   # 北京时间6点开始采集
    "collection_end_hour": 8,     # 北京时间8点结束采集
    "max_collection_duration": 2, # 最长采集时间2小时
}

# ============================================
# 不同排序方式的时间策略
# ============================================

SORT_TIME_STRATEGY = {
    "hot": {
        "max_age_days": 3,        # hot排序主要看最近3天
        "min_score_by_age": {
            "0-6h": 50,           # 6小时内至少50分
            "6-24h": 100,         # 24小时内至少100分
            "1-3d": 200,          # 1-3天内至少200分
        }
    },
    
    "top": {
        "time_range": "week",     # 一周内的top帖子
        "max_age_days": 7,        # 最多7天内
        "min_score": 500,         # 高分要求
    },
    
    "new": {
        "max_age_hours": 24,      # 只看最近24小时
        "min_age_hours": 1,       # 至少1小时前发布
        "min_score": 10,          # 较低分数要求
    },
    
    "rising": {
        "max_age_hours": 12,      # 只看最近12小时
        "min_age_hours": 1,       # 至少1小时前发布
        "growth_rate_required": True, # 需要快速增长
    }
}

# ============================================
# 时间质量评分权重
# ============================================

TIME_QUALITY_WEIGHTS = {
    # 基于发布时间的质量权重
    "recency_bonus": {
        "0-6h": 1.2,     # 6小时内发布+20%权重
        "6-24h": 1.1,    # 24小时内发布+10%权重  
        "1-3d": 1.0,     # 1-3天内发布正常权重
        "3-7d": 0.9,     # 3-7天内发布-10%权重
        "7-30d": 0.8,    # 7-30天内发布-20%权重
    },
    
    # 基于采集时间的处理优先级
    "collection_priority": {
        "peak_hours": 1.3,    # 高峰时段发布+30%优先级
        "normal_hours": 1.0,  # 正常时段
        "off_hours": 0.9,     # 非活跃时段-10%优先级
    }
}

# ============================================
# 工具函数
# ============================================

def get_post_age_category(created_utc):
    """
    获取帖子年龄分类
    """
    now = time.time()
    age_seconds = now - created_utc
    age_hours = age_seconds / 3600
    age_days = age_hours / 24
    
    if age_hours < 6:
        return "0-6h"
    elif age_hours < 24:
        return "6-24h"
    elif age_days < 3:
        return "1-3d"
    elif age_days < 7:
        return "3-7d"
    elif age_days < 30:
        return "7-30d"
    else:
        return "too_old"

def is_within_time_limit(created_utc, sort_method="hot"):
    """
    检查帖子是否在时间限制内
    """
    strategy = SORT_TIME_STRATEGY.get(sort_method, SORT_TIME_STRATEGY["hot"])
    
    now = time.time()
    age_seconds = now - created_utc
    age_hours = age_seconds / 3600
    age_days = age_hours / 24
    
    # 检查最大年龄限制
    if "max_age_days" in strategy and age_days > strategy["max_age_days"]:
        return False, f"帖子过老: {age_days:.1f}天"
    
    if "max_age_hours" in strategy and age_hours > strategy["max_age_hours"]:
        return False, f"帖子过老: {age_hours:.1f}小时"
    
    # 检查最小年龄限制
    min_age = strategy.get("min_age_hours", TIME_FILTER_CONFIG["min_age_hours"])
    if age_hours < min_age:
        return False, f"帖子太新: {age_hours:.1f}小时"
    
    return True, "时间范围内"

def calculate_time_quality_score(created_utc, current_score):
    """
    基于时间计算质量评分加权
    """
    age_category = get_post_age_category(created_utc)
    
    if age_category == "too_old":
        return 0  # 太老的帖子直接过滤
    
    # 应用年龄权重
    recency_weight = TIME_QUALITY_WEIGHTS["recency_bonus"].get(age_category, 0.5)
    
    # 检查是否在高峰时段发布
    post_time = datetime.fromtimestamp(created_utc, tz=pytz.UTC)
    post_hour = post_time.hour
    
    if post_hour in TIME_FILTER_CONFIG["peak_hours"]:
        priority_weight = TIME_QUALITY_WEIGHTS["collection_priority"]["peak_hours"]
    else:
        priority_weight = TIME_QUALITY_WEIGHTS["collection_priority"]["normal_hours"]
    
    # 计算最终评分
    final_score = current_score * recency_weight * priority_weight
    return final_score

def get_optimal_collection_window():
    """
    获取最佳采集时间窗口
    """
    now = datetime.now(BEIJING_TZ)
    
    # 每日采集窗口：北京时间6-8点
    start_time = now.replace(
        hour=TIME_FILTER_CONFIG["collection_start_hour"], 
        minute=0, 
        second=0, 
        microsecond=0
    )
    end_time = now.replace(
        hour=TIME_FILTER_CONFIG["collection_end_hour"], 
        minute=0, 
        second=0, 
        microsecond=0
    )
    
    return start_time, end_time

def is_in_collection_window():
    """
    检查当前是否在采集时间窗口内
    """
    start_time, end_time = get_optimal_collection_window()
    now = datetime.now(BEIJING_TZ)
    
    return start_time <= now <= end_time

def get_posts_filter_by_sort(sort_method, subreddit_config):
    """
    根据排序方式获取帖子过滤器
    """
    strategy = SORT_TIME_STRATEGY.get(sort_method, SORT_TIME_STRATEGY["hot"])
    base_config = subreddit_config.copy()
    
    # 根据排序方式调整筛选条件
    if sort_method == "new":
        base_config["min_score"] = max(10, base_config["min_score"] // 5)  # 新帖子降低分数要求
    elif sort_method == "top":
        base_config["min_score"] = max(base_config["min_score"], 200)  # 热门帖子提高分数要求
    
    return base_config

def format_time_debug_info(created_utc):
    """
    格式化时间调试信息
    """
    post_time = datetime.fromtimestamp(created_utc, tz=pytz.UTC)
    beijing_time = post_time.astimezone(BEIJING_TZ)
    age_category = get_post_age_category(created_utc)
    
    now = time.time()
    age_hours = (now - created_utc) / 3600
    
    return {
        "post_time_utc": post_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "post_time_beijing": beijing_time.strftime("%Y-%m-%d %H:%M:%S CST"),
        "age_hours": round(age_hours, 1),
        "age_category": age_category,
        "is_peak_hour": post_time.hour in TIME_FILTER_CONFIG["peak_hours"]
    }

# ============================================
# 每日时间限制检查
# ============================================

def check_daily_collection_constraints():
    """
    检查每日采集约束
    """
    constraints = {
        "collection_window": is_in_collection_window(),
        "max_age_limit": TIME_FILTER_CONFIG["max_age_days"],
        "min_age_limit": TIME_FILTER_CONFIG["min_age_hours"],
        "current_beijing_time": datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S CST")
    }
    
    return constraints

if __name__ == "__main__":
    print("Reddit 帖子时间过滤配置")
    print("=" * 50)
    
    # 显示当前配置
    print(f"最大帖子年龄: {TIME_FILTER_CONFIG['max_age_days']} 天")
    print(f"最小帖子年龄: {TIME_FILTER_CONFIG['min_age_hours']} 小时")
    print(f"采集时间窗口: {TIME_FILTER_CONFIG['collection_start_hour']}:00 - {TIME_FILTER_CONFIG['collection_end_hour']}:00 (北京时间)")
    
    # 检查当前状态
    constraints = check_daily_collection_constraints()
    print(f"\n当前北京时间: {constraints['current_beijing_time']}")
    print(f"是否在采集窗口内: {'✅ 是' if constraints['collection_window'] else '❌ 否'}")
    
    # 测试时间过滤
    test_timestamps = [
        time.time() - 3600,      # 1小时前
        time.time() - 86400,     # 1天前  
        time.time() - 604800,    # 1周前
        time.time() - 2592000,   # 1月前
    ]
    
    print("\n时间过滤测试:")
    for i, ts in enumerate(test_timestamps):
        age_cat = get_post_age_category(ts)
        is_valid, reason = is_within_time_limit(ts, "hot")
        print(f"  测试{i+1}: {age_cat} - {'✅ 通过' if is_valid else '❌ ' + reason}")
