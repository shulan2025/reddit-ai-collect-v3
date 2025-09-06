#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
时间工具模块 - 统一处理北京时间格式
所有时间戳都转换为北京时间显示
"""

import pytz
from datetime import datetime, timezone
import time

# 北京时区
BEIJING_TZ = pytz.timezone('Asia/Shanghai')
UTC_TZ = pytz.UTC

class BeijingTimeFormatter:
    """北京时间格式化工具类"""
    
    @staticmethod
    def now():
        """获取当前北京时间"""
        return datetime.now(BEIJING_TZ)
    
    @staticmethod
    def now_timestamp():
        """获取当前北京时间戳"""
        return int(datetime.now(BEIJING_TZ).timestamp())
    
    @staticmethod
    def from_timestamp(timestamp, format_str="%Y-%m-%d %H:%M:%S"):
        """从时间戳转换为北京时间字符串"""
        if not timestamp:
            return "未知时间"
        
        try:
            # 将时间戳转换为UTC datetime
            utc_dt = datetime.fromtimestamp(timestamp, tz=UTC_TZ)
            # 转换为北京时间
            beijing_dt = utc_dt.astimezone(BEIJING_TZ)
            return beijing_dt.strftime(format_str)
        except (ValueError, TypeError, OSError):
            return "时间格式错误"
    
    @staticmethod
    def from_timestamp_with_tz(timestamp, format_str="%Y-%m-%d %H:%M:%S %Z"):
        """从时间戳转换为北京时间字符串（包含时区）"""
        if not timestamp:
            return "未知时间"
        
        try:
            utc_dt = datetime.fromtimestamp(timestamp, tz=UTC_TZ)
            beijing_dt = utc_dt.astimezone(BEIJING_TZ)
            return beijing_dt.strftime(format_str)
        except (ValueError, TypeError, OSError):
            return "时间格式错误"
    
    @staticmethod
    def from_utc_timestamp(utc_timestamp, format_str="%Y-%m-%d %H:%M:%S"):
        """从UTC时间戳转换为北京时间"""
        if not utc_timestamp:
            return "未知时间"
        
        try:
            utc_dt = datetime.fromtimestamp(utc_timestamp, tz=UTC_TZ)
            beijing_dt = utc_dt.astimezone(BEIJING_TZ)
            return beijing_dt.strftime(format_str)
        except (ValueError, TypeError, OSError):
            return "时间格式错误"
    
    @staticmethod
    def reddit_time_to_beijing(reddit_utc_timestamp):
        """Reddit UTC时间戳转北京时间"""
        return BeijingTimeFormatter.from_utc_timestamp(reddit_utc_timestamp)
    
    @staticmethod
    def format_duration(seconds):
        """格式化时长显示"""
        if seconds < 60:
            return f"{seconds:.1f}秒"
        elif seconds < 3600:
            minutes = seconds / 60
            return f"{minutes:.1f}分钟"
        else:
            hours = seconds / 3600
            return f"{hours:.1f}小时"
    
    @staticmethod
    def format_relative_time(timestamp):
        """格式化相对时间显示"""
        if not timestamp:
            return "未知时间"
        
        try:
            target_time = datetime.fromtimestamp(timestamp, tz=UTC_TZ).astimezone(BEIJING_TZ)
            now = datetime.now(BEIJING_TZ)
            diff = now - target_time
            
            if diff.days > 0:
                return f"{diff.days}天前"
            elif diff.seconds > 3600:
                hours = diff.seconds // 3600
                return f"{hours}小时前"
            elif diff.seconds > 60:
                minutes = diff.seconds // 60
                return f"{minutes}分钟前"
            else:
                return "刚刚"
        except (ValueError, TypeError, OSError):
            return "时间格式错误"
    
    @staticmethod
    def get_today_date_str():
        """获取今天的日期字符串 (YYYY-MM-DD)"""
        return datetime.now(BEIJING_TZ).strftime('%Y-%m-%d')
    
    @staticmethod
    def get_next_collection_time():
        """获取下次采集时间"""
        now = datetime.now(BEIJING_TZ)
        next_time = now.replace(hour=6, minute=0, second=0, microsecond=0)
        
        # 如果今天的6点已过，设为明天6点
        if next_time <= now:
            from datetime import timedelta
            next_time = next_time + timedelta(days=1)
        
        return next_time
    
    @staticmethod
    def time_until_next_collection():
        """距离下次采集的时间"""
        next_time = BeijingTimeFormatter.get_next_collection_time()
        now = datetime.now(BEIJING_TZ)
        return next_time - now

# 便捷函数
def beijing_now():
    """获取当前北京时间"""
    return BeijingTimeFormatter.now()

def beijing_timestamp():
    """获取当前北京时间戳"""
    return BeijingTimeFormatter.now_timestamp()

def format_beijing_time(timestamp, include_tz=True):
    """格式化为北京时间字符串"""
    if include_tz:
        return BeijingTimeFormatter.from_timestamp_with_tz(timestamp)
    else:
        return BeijingTimeFormatter.from_timestamp(timestamp)

def reddit_to_beijing(reddit_utc):
    """Reddit UTC时间转北京时间"""
    return BeijingTimeFormatter.reddit_time_to_beijing(reddit_utc)

def relative_time(timestamp):
    """相对时间显示"""
    return BeijingTimeFormatter.format_relative_time(timestamp)

def today_date():
    """今天日期"""
    return BeijingTimeFormatter.get_today_date_str()

def next_collection_time():
    """下次采集时间"""
    return BeijingTimeFormatter.get_next_collection_time()

def format_duration(seconds):
    """格式化时长"""
    return BeijingTimeFormatter.format_duration(seconds)

# 日志时间格式化
def log_time_format():
    """日志专用时间格式"""
    return beijing_now().strftime('%Y-%m-%d %H:%M:%S CST')

# 数据库友好的时间格式
def db_time_format(timestamp=None):
    """数据库友好的时间格式"""
    if timestamp:
        return BeijingTimeFormatter.from_timestamp(timestamp, '%Y-%m-%d %H:%M:%S')
    else:
        return beijing_now().strftime('%Y-%m-%d %H:%M:%S')

if __name__ == "__main__":
    # 测试时间工具
    print("🕐 北京时间工具测试")
    print("=" * 40)
    
    # 当前时间
    print(f"当前北京时间: {beijing_now().strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"当前时间戳: {beijing_timestamp()}")
    print(f"今日日期: {today_date()}")
    
    # 时间转换测试
    test_timestamp = 1699876543  # 示例时间戳
    print(f"\n时间戳转换测试:")
    print(f"原始时间戳: {test_timestamp}")
    print(f"北京时间: {format_beijing_time(test_timestamp)}")
    print(f"相对时间: {relative_time(test_timestamp)}")
    
    # 下次采集时间
    next_time = next_collection_time()
    time_until = BeijingTimeFormatter.time_until_next_collection()
    print(f"\n采集时间信息:")
    print(f"下次采集: {next_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"距离下次: {time_until}")
    
    print("\n✅ 时间工具测试完成")
