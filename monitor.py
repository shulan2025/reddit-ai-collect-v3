#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
监控和统计模块
提供系统监控、数据统计和健康检查功能
"""

import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import pytz

from database_manager import D1DatabaseManager
from daily_collection_config import TARGET_SUBREDDITS, get_collection_date

class SystemMonitor:
    """系统监控器"""
    
    def __init__(self):
        self.db = D1DatabaseManager()
        self.beijing_tz = pytz.timezone('Asia/Shanghai')
        self.logger = logging.getLogger(__name__)
    
    def get_daily_summary(self, date_str: Optional[str] = None) -> Dict:
        """获取每日采集汇总"""
        if not date_str:
            date_str = get_collection_date()
        
        # 基本统计
        total_posts = self._get_posts_count_by_date(date_str)
        subreddit_stats = self._get_subreddit_stats_by_date(date_str)
        
        # 任务状态
        task_status = self.db.get_daily_task_status(date_str)
        
        # 质量统计
        quality_stats = self._get_quality_stats_by_date(date_str)
        
        # 目标完成度
        target_posts = 200
        completion_rate = (total_posts / target_posts) * 100 if target_posts > 0 else 0
        
        return {
            "date": date_str,
            "total_posts": total_posts,
            "target_posts": target_posts,
            "completion_rate": round(completion_rate, 1),
            "task_status": task_status.get("task_status") if task_status else "unknown",
            "subreddit_breakdown": subreddit_stats,
            "quality_stats": quality_stats,
            "task_details": task_status
        }
    
    def get_weekly_summary(self, weeks: int = 1) -> Dict:
        """获取周汇总统计"""
        end_date = datetime.now(self.beijing_tz).date()
        start_date = end_date - timedelta(days=weeks * 7)
        
        weekly_data = []
        total_posts = 0
        total_target = 0
        
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime('%Y-%m-%d')
            daily_summary = self.get_daily_summary(date_str)
            
            if daily_summary["total_posts"] > 0:  # 只包含有数据的日期
                weekly_data.append(daily_summary)
                total_posts += daily_summary["total_posts"]
                total_target += daily_summary["target_posts"]
            
            current_date += timedelta(days=1)
        
        # 计算平均值
        days_with_data = len(weekly_data)
        avg_posts_per_day = total_posts / days_with_data if days_with_data > 0 else 0
        overall_completion = (total_posts / total_target) * 100 if total_target > 0 else 0
        
        return {
            "period": f"{start_date} to {end_date}",
            "total_posts": total_posts,
            "total_target": total_target,
            "days_with_data": days_with_data,
            "avg_posts_per_day": round(avg_posts_per_day, 1),
            "overall_completion_rate": round(overall_completion, 1),
            "daily_data": weekly_data
        }
    
    def _get_posts_count_by_date(self, date_str: str) -> int:
        """获取指定日期的帖子数量"""
        sql = "SELECT COUNT(*) as count FROM reddit_ai_posts WHERE crawl_date = ?"
        result = self.db.execute_query(sql, [date_str])
        return result.get("results", [{}])[0].get("count", 0)
    
    def _get_subreddit_stats_by_date(self, date_str: str) -> Dict[str, int]:
        """获取指定日期各子版块统计"""
        sql = """
        SELECT subreddit, COUNT(*) as count 
        FROM reddit_ai_posts 
        WHERE crawl_date = ?
        GROUP BY subreddit
        ORDER BY count DESC
        """
        result = self.db.execute_query(sql, [date_str])
        
        stats = {}
        for row in result.get("results", []):
            stats[row["subreddit"]] = row["count"]
        
        return stats
    
    def _get_quality_stats_by_date(self, date_str: str) -> Dict:
        """获取指定日期质量统计"""
        sql = """
        SELECT 
            AVG(quality_score) as avg_quality,
            AVG(score) as avg_reddit_score,
            AVG(num_comments) as avg_comments,
            AVG(upvote_ratio) as avg_upvote_ratio,
            COUNT(CASE WHEN quality_score >= 70 THEN 1 END) as high_quality_count,
            COUNT(CASE WHEN quality_score >= 50 THEN 1 END) as medium_quality_count
        FROM reddit_ai_posts 
        WHERE crawl_date = ?
        """
        result = self.db.execute_query(sql, [date_str])
        
        if result.get("results"):
            stats = result["results"][0]
            total_posts = self._get_posts_count_by_date(date_str)
            
            return {
                "avg_quality_score": round(stats.get("avg_quality", 0), 1),
                "avg_reddit_score": round(stats.get("avg_reddit_score", 0), 1),
                "avg_comments": round(stats.get("avg_comments", 0), 1),
                "avg_upvote_ratio": round(stats.get("avg_upvote_ratio", 0), 2),
                "high_quality_count": stats.get("high_quality_count", 0),
                "medium_quality_count": stats.get("medium_quality_count", 0),
                "high_quality_rate": round((stats.get("high_quality_count", 0) / total_posts) * 100, 1) if total_posts > 0 else 0
            }
        
        return {}
    
    def get_subreddit_performance(self, days: int = 7) -> List[Dict]:
        """获取各子版块性能分析"""
        sql = """
        SELECT 
            subreddit,
            COUNT(*) as total_posts,
            AVG(quality_score) as avg_quality,
            AVG(score) as avg_score,
            AVG(num_comments) as avg_comments,
            COUNT(DISTINCT crawl_date) as active_days
        FROM reddit_ai_posts 
        WHERE crawl_date >= date('now', '-{} days')
        GROUP BY subreddit
        ORDER BY total_posts DESC
        """.format(days)
        
        result = self.db.execute_query(sql)
        performance_data = []
        
        for row in result.get("results", []):
            subreddit = row["subreddit"]
            
            # 查找目标配置
            target_config = next(
                (s for s in TARGET_SUBREDDITS if s["name"] == subreddit), 
                {"target_posts": 0}
            )
            
            target_per_day = target_config.get("target_posts", 0)
            actual_per_day = row["total_posts"] / max(1, row["active_days"])
            achievement_rate = (actual_per_day / target_per_day * 100) if target_per_day > 0 else 0
            
            performance_data.append({
                "subreddit": subreddit,
                "total_posts": row["total_posts"],
                "target_per_day": target_per_day,
                "actual_per_day": round(actual_per_day, 1),
                "achievement_rate": round(achievement_rate, 1),
                "avg_quality": round(row.get("avg_quality", 0), 1),
                "avg_score": round(row.get("avg_score", 0), 1),
                "avg_comments": round(row.get("avg_comments", 0), 1),
                "active_days": row["active_days"]
            })
        
        return performance_data
    
    def get_keyword_trends(self, days: int = 7, limit: int = 20) -> List[Dict]:
        """获取关键词趋势"""
        sql = """
        SELECT 
            k.keyword,
            k.category,
            COUNT(*) as frequency,
            AVG(p.quality_score) as avg_quality,
            COUNT(DISTINCT p.crawl_date) as active_days
        FROM reddit_post_keywords k
        JOIN reddit_ai_posts p ON k.post_id = p.id
        WHERE p.crawl_date >= date('now', '-{} days')
        GROUP BY k.keyword, k.category
        HAVING frequency >= 3
        ORDER BY frequency DESC, avg_quality DESC
        LIMIT {}
        """.format(days, limit)
        
        result = self.db.execute_query(sql)
        trends = []
        
        for row in result.get("results", []):
            trends.append({
                "keyword": row["keyword"],
                "category": row.get("category", "未分类"),
                "frequency": row["frequency"],
                "avg_quality": round(row.get("avg_quality", 0), 1),
                "active_days": row["active_days"],
                "daily_frequency": round(row["frequency"] / max(1, row["active_days"]), 1)
            })
        
        return trends
    
    def get_system_health(self) -> Dict:
        """获取系统健康状态"""
        now = datetime.now(self.beijing_tz)
        today = get_collection_date()
        
        # 检查今日采集状态
        today_posts = self._get_posts_count_by_date(today)
        task_status = self.db.get_daily_task_status(today)
        
        # 检查最近几天的采集情况
        recent_days = []
        for i in range(3):
            check_date = (now.date() - timedelta(days=i)).strftime('%Y-%m-%d')
            count = self._get_posts_count_by_date(check_date)
            recent_days.append({"date": check_date, "posts": count})
        
        # 检查数据库连接
        db_healthy = True
        try:
            self.db.execute_query("SELECT 1")
        except:
            db_healthy = False
        
        # 计算健康评分
        health_score = 100
        
        # 今日采集完成度
        target_completion = (today_posts / 200) * 100
        if target_completion < 50:
            health_score -= 30
        elif target_completion < 80:
            health_score -= 15
        
        # 最近几天平均采集量
        recent_avg = sum(day["posts"] for day in recent_days) / len(recent_days)
        if recent_avg < 100:
            health_score -= 20
        elif recent_avg < 150:
            health_score -= 10
        
        # 数据库连接
        if not db_healthy:
            health_score -= 40
        
        # 任务状态
        if task_status and task_status.get("task_status") == "failed":
            health_score -= 25
        
        health_score = max(0, health_score)
        
        # 确定状态等级
        if health_score >= 90:
            status_level = "优秀"
            status_icon = "🟢"
        elif health_score >= 70:
            status_level = "良好"
            status_icon = "🟡"
        elif health_score >= 50:
            status_level = "警告"
            status_icon = "🟠"
        else:
            status_level = "严重"
            status_icon = "🔴"
        
        return {
            "timestamp": now.strftime('%Y-%m-%d %H:%M:%S %Z'),
            "health_score": health_score,
            "status_level": status_level,
            "status_icon": status_icon,
            "today_posts": today_posts,
            "today_target": 200,
            "today_completion": round(target_completion, 1),
            "task_status": task_status.get("task_status") if task_status else "unknown",
            "recent_days_avg": round(recent_avg, 1),
            "database_healthy": db_healthy,
            "recent_days": recent_days
        }
    
    def generate_report(self, format_type: str = "text") -> str:
        """生成监控报告"""
        health = self.get_system_health()
        daily_summary = self.get_daily_summary()
        weekly_summary = self.get_weekly_summary()
        subreddit_performance = self.get_subreddit_performance()
        keyword_trends = self.get_keyword_trends(limit=10)
        
        if format_type == "text":
            return self._generate_text_report(
                health, daily_summary, weekly_summary, 
                subreddit_performance, keyword_trends
            )
        elif format_type == "json":
            import json
            return json.dumps({
                "health": health,
                "daily_summary": daily_summary,
                "weekly_summary": weekly_summary,
                "subreddit_performance": subreddit_performance,
                "keyword_trends": keyword_trends
            }, indent=2, ensure_ascii=False)
        else:
            raise ValueError(f"不支持的报告格式: {format_type}")
    
    def _generate_text_report(self, health, daily, weekly, subreddit_perf, keywords) -> str:
        """生成文本格式报告"""
        report = []
        
        # 标题
        report.append("Reddit AI 内容采集系统监控报告")
        report.append("=" * 50)
        report.append(f"生成时间: {health['timestamp']}")
        report.append("")
        
        # 系统健康状态
        report.append("🏥 系统健康状态")
        report.append("-" * 20)
        report.append(f"{health['status_icon']} 健康评分: {health['health_score']}/100 ({health['status_level']})")
        report.append(f"📊 今日采集: {health['today_posts']}/{health['today_target']} ({health['today_completion']}%)")
        report.append(f"⚡ 任务状态: {health['task_status']}")
        report.append(f"💾 数据库: {'正常' if health['database_healthy'] else '异常'}")
        report.append(f"📈 最近平均: {health['recent_days_avg']} 帖子/天")
        report.append("")
        
        # 每日汇总
        report.append("📅 今日汇总")
        report.append("-" * 20)
        report.append(f"日期: {daily['date']}")
        report.append(f"完成度: {daily['completion_rate']}% ({daily['total_posts']}/{daily['target_posts']})")
        if daily['quality_stats']:
            qs = daily['quality_stats']
            report.append(f"平均质量: {qs['avg_quality_score']}/100")
            report.append(f"高质量率: {qs['high_quality_rate']}%")
        report.append("")
        
        # 周汇总
        report.append("📊 本周汇总")
        report.append("-" * 20)
        report.append(f"时间范围: {weekly['period']}")
        report.append(f"总采集量: {weekly['total_posts']} 帖子")
        report.append(f"日均采集: {weekly['avg_posts_per_day']} 帖子")
        report.append(f"整体完成度: {weekly['overall_completion_rate']}%")
        report.append("")
        
        # 子版块性能
        report.append("🎯 子版块性能 (前10名)")
        report.append("-" * 20)
        for i, perf in enumerate(subreddit_perf[:10]):
            report.append(f"{i+1:2d}. r/{perf['subreddit']}: {perf['total_posts']} 帖子 "
                         f"(目标达成: {perf['achievement_rate']}%, 质量: {perf['avg_quality']})")
        report.append("")
        
        # 热门关键词
        report.append("🔥 热门关键词 (前10名)")
        report.append("-" * 20)
        for i, kw in enumerate(keywords[:10]):
            report.append(f"{i+1:2d}. {kw['keyword']} ({kw['category']}): {kw['frequency']} 次")
        report.append("")
        
        report.append("报告生成完成 ✅")
        
        return "\n".join(report)

def main():
    """主程序入口"""
    import sys
    
    monitor = SystemMonitor()
    
    if len(sys.argv) < 2:
        print("使用方法:")
        print("  python monitor.py health     # 显示系统健康状态")
        print("  python monitor.py daily      # 显示今日汇总")
        print("  python monitor.py weekly     # 显示本周汇总")
        print("  python monitor.py subreddit  # 显示子版块性能")
        print("  python monitor.py keywords   # 显示关键词趋势")
        print("  python monitor.py report     # 生成完整报告")
        return 1
    
    command = sys.argv[1]
    
    if command == "health":
        health = monitor.get_system_health()
        print(f"系统健康状态: {health['status_icon']} {health['status_level']} ({health['health_score']}/100)")
        print(f"今日采集: {health['today_posts']}/{health['today_target']} ({health['today_completion']}%)")
        print(f"任务状态: {health['task_status']}")
        
    elif command == "daily":
        summary = monitor.get_daily_summary()
        print(f"今日汇总 ({summary['date']}):")
        print(f"  采集完成度: {summary['completion_rate']}% ({summary['total_posts']}/{summary['target_posts']})")
        print(f"  任务状态: {summary['task_status']}")
        
    elif command == "weekly":
        summary = monitor.get_weekly_summary()
        print(f"本周汇总 ({summary['period']}):")
        print(f"  总采集量: {summary['total_posts']} 帖子")
        print(f"  日均采集: {summary['avg_posts_per_day']} 帖子")
        print(f"  整体完成度: {summary['overall_completion_rate']}%")
        
    elif command == "subreddit":
        performance = monitor.get_subreddit_performance()
        print("子版块性能 (前10名):")
        for i, perf in enumerate(performance[:10]):
            print(f"  {i+1:2d}. r/{perf['subreddit']}: {perf['total_posts']} 帖子 "
                  f"(达成率: {perf['achievement_rate']}%)")
    
    elif command == "keywords":
        trends = monitor.get_keyword_trends()
        print("热门关键词 (前10名):")
        for i, kw in enumerate(trends[:10]):
            print(f"  {i+1:2d}. {kw['keyword']} ({kw['category']}): {kw['frequency']} 次")
    
    elif command == "report":
        report = monitor.generate_report("text")
        print(report)
    
    else:
        print(f"未知命令: {command}")
        return 1
    
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
