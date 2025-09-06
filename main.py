#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reddit AI 内容采集系统主程序
统一入口，提供各种功能的命令行接口
"""

import sys
import os
import argparse
from datetime import datetime
import pytz

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import validate_config
from reddit_crawler import RedditAICrawler
from scheduler import SchedulerManager
from monitor import SystemMonitor
from database_manager import D1DatabaseManager

def setup_environment():
    """环境检查和设置"""
    try:
        # 验证配置
        validate_config()
        print("✅ 配置验证通过")
        
        # 测试数据库连接
        db = D1DatabaseManager()
        result = db.execute_query("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'")
        if result.get("results"):
            table_count = result["results"][0]["count"]
            print(f"✅ 数据库连接正常，发现 {table_count} 个表")
        else:
            print("⚠️ 数据库连接成功，但可能未初始化")
        
        return True
        
    except Exception as e:
        print(f"❌ 环境检查失败: {e}")
        return False

def run_collection():
    """执行采集任务"""
    print("开始执行Reddit AI内容采集...")
    
    try:
        crawler = RedditAICrawler()
        success = crawler.collect_daily_posts()
        
        summary = crawler.get_collection_summary()
        
        print("\n=== 采集结果汇总 ===")
        print(f"执行时间: {summary['duration_seconds']} 秒")
        print(f"今日总计: {summary['today_total']} 个帖子")
        print(f"目标完成度: {summary['target_achievement']}")
        print(f"API调用数: {summary['api_calls']}")
        
        if summary['subreddit_breakdown']:
            print("\n各子版块统计:")
            for subreddit, count in sorted(summary['subreddit_breakdown'].items(), key=lambda x: x[1], reverse=True):
                print(f"  r/{subreddit}: {count} 个帖子")
        
        if summary['errors']:
            print(f"\n⚠️ 错误数量: {len(summary['errors'])}")
            for error in summary['errors'][:3]:  # 显示前3个错误
                print(f"  {error}")
        
        print(f"\n采集状态: {'✅ 成功' if success else '❌ 失败'}")
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ 采集执行失败: {e}")
        return 1

def run_scheduler(mode="start"):
    """运行调度器"""
    manager = SchedulerManager()
    
    if mode == "start":
        print("启动Reddit AI采集调度器 (前台运行)...")
        print("按 Ctrl+C 停止")
        manager.start_foreground()
    
    elif mode == "daemon":
        print("后台启动Reddit AI采集调度器...")
        manager.start_daemon()
    
    elif mode == "status":
        manager.status()
    
    elif mode == "run":
        print("立即执行一次采集任务...")
        manager.run_now()
    
    return 0

def run_monitor(command="health"):
    """运行监控"""
    monitor = SystemMonitor()
    
    if command == "health":
        health = monitor.get_system_health()
        print("🏥 系统健康状态")
        print("=" * 30)
        print(f"{health['status_icon']} 健康评分: {health['health_score']}/100 ({health['status_level']})")
        print(f"📊 今日采集: {health['today_posts']}/{health['today_target']} ({health['today_completion']}%)")
        print(f"⚡ 任务状态: {health['task_status']}")
        print(f"💾 数据库: {'正常' if health['database_healthy'] else '异常'}")
        print(f"📈 最近平均: {health['recent_days_avg']} 帖子/天")
        print(f"🕐 检查时间: {health['timestamp']}")
    
    elif command == "daily":
        summary = monitor.get_daily_summary()
        print("📅 今日采集汇总")
        print("=" * 30)
        print(f"日期: {summary['date']}")
        print(f"完成度: {summary['completion_rate']}% ({summary['total_posts']}/{summary['target_posts']})")
        print(f"任务状态: {summary['task_status']}")
        
        if summary['quality_stats']:
            qs = summary['quality_stats']
            print(f"平均质量: {qs['avg_quality_score']}/100")
            print(f"高质量率: {qs['high_quality_rate']}%")
            print(f"平均分数: {qs['avg_reddit_score']}")
        
        if summary['subreddit_breakdown']:
            print("\n各子版块统计:")
            for sub, count in sorted(summary['subreddit_breakdown'].items(), key=lambda x: x[1], reverse=True):
                print(f"  r/{sub}: {count} 个帖子")
    
    elif command == "weekly":
        summary = monitor.get_weekly_summary()
        print("📊 本周采集汇总")
        print("=" * 30)
        print(f"时间范围: {summary['period']}")
        print(f"总采集量: {summary['total_posts']} 帖子")
        print(f"活跃天数: {summary['days_with_data']} 天")
        print(f"日均采集: {summary['avg_posts_per_day']} 帖子")
        print(f"整体完成度: {summary['overall_completion_rate']}%")
    
    elif command == "report":
        report = monitor.generate_report("text")
        print(report)
    
    return 0

def run_database(command="status"):
    """数据库管理"""
    db = D1DatabaseManager()
    
    if command == "status":
        print("💾 数据库状态")
        print("=" * 30)
        
        # 基本统计
        total_posts = db.get_today_post_count()
        print(f"今日帖子数: {total_posts}")
        
        # 最近统计
        stats = db.get_collection_stats(7)
        if stats:
            print("\n最近7天统计:")
            for stat in stats[:5]:  # 显示最近5天
                print(f"  {stat['crawl_date']}: {stat['post_count']} 帖子 (平均质量: {stat.get('avg_quality', 0):.1f})")
        
        # 子版块统计
        subreddit_stats = db.get_today_posts_by_subreddit()
        if subreddit_stats:
            print("\n今日各子版块:")
            for sub, count in sorted(subreddit_stats.items(), key=lambda x: x[1], reverse=True):
                print(f"  r/{sub}: {count} 个帖子")
    
    elif command == "cleanup":
        print("清理90天前的旧数据...")
        deleted = db.cleanup_old_data(90)
        print(f"清理完成，删除了 {deleted} 条记录")
    
    elif command == "test":
        print("测试数据库连接...")
        result = db.execute_query("SELECT COUNT(*) as count FROM reddit_ai_posts")
        if result.get("results"):
            count = result["results"][0]["count"]
            print(f"✅ 连接成功，数据库中共有 {count} 条帖子记录")
        else:
            print("❌ 连接失败或查询错误")
    
    return 0

def main():
    """主程序入口"""
    parser = argparse.ArgumentParser(description="Reddit AI 内容采集系统")
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # 环境检查命令
    parser_env = subparsers.add_parser('env', help='检查环境配置')
    
    # 采集命令
    parser_collect = subparsers.add_parser('collect', help='执行采集任务')
    
    # 调度器命令
    parser_scheduler = subparsers.add_parser('scheduler', help='调度器管理')
    parser_scheduler.add_argument('action', choices=['start', 'daemon', 'status', 'run'], 
                                 help='调度器操作')
    
    # 监控命令
    parser_monitor = subparsers.add_parser('monitor', help='系统监控')
    parser_monitor.add_argument('action', choices=['health', 'daily', 'weekly', 'report'],
                               default='health', nargs='?', help='监控操作')
    
    # 数据库命令
    parser_db = subparsers.add_parser('database', help='数据库管理')
    parser_db.add_argument('action', choices=['status', 'cleanup', 'test'],
                          default='status', nargs='?', help='数据库操作')
    
    # 解析参数
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # 显示标题
    beijing_tz = pytz.timezone('Asia/Shanghai')
    current_time = datetime.now(beijing_tz).strftime('%Y-%m-%d %H:%M:%S CST')
    
    print("Reddit AI 内容采集系统")
    print("=" * 50)
    print(f"当前时间: {current_time}")
    print()
    
    # 执行命令
    if args.command == 'env':
        return 0 if setup_environment() else 1
    
    elif args.command == 'collect':
        if not setup_environment():
            return 1
        return run_collection()
    
    elif args.command == 'scheduler':
        if not setup_environment():
            return 1
        return run_scheduler(args.action)
    
    elif args.command == 'monitor':
        if not setup_environment():
            return 1
        return run_monitor(args.action)
    
    elif args.command == 'database':
        if not setup_environment():
            return 1
        return run_database(args.action)
    
    else:
        parser.print_help()
        return 1

if __name__ == "__main__":
    sys.exit(main())
