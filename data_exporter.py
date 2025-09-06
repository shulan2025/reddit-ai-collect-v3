#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据导出工具 - 将所有时间戳转换为北京时间格式
用于查看和导出数据库中的数据，时间戳自动转换为可读的北京时间
"""

import json
import csv
import pytz
from datetime import datetime
from typing import List, Dict, Any, Optional
from database_manager import D1DatabaseManager

class DataExporter:
    """数据导出器 - 自动转换时间格式"""
    
    def __init__(self):
        self.db = D1DatabaseManager()
        self.beijing_tz = pytz.timezone('Asia/Shanghai')
        self.utc_tz = pytz.UTC
    
    def convert_timestamp_to_beijing(self, timestamp: int) -> str:
        """将时间戳转换为北京时间字符串"""
        if not timestamp:
            return "未知时间"
        
        try:
            # 将UTC时间戳转换为北京时间
            utc_dt = datetime.fromtimestamp(timestamp, tz=self.utc_tz)
            beijing_dt = utc_dt.astimezone(self.beijing_tz)
            return beijing_dt.strftime('%Y-%m-%d %H:%M:%S CST')
        except (ValueError, TypeError, OSError):
            return "时间格式错误"
    
    def format_post_data(self, post: Dict) -> Dict:
        """格式化单个帖子数据，转换时间戳"""
        formatted_post = post.copy()
        
        # 转换时间字段
        time_fields = ['created_utc', 'crawl_timestamp', 'processed_at', 'last_updated']
        
        for field in time_fields:
            if field in formatted_post and formatted_post[field]:
                # 保留原始时间戳（添加_raw后缀）
                formatted_post[f"{field}_raw"] = formatted_post[field]
                # 转换为北京时间
                formatted_post[f"{field}_beijing"] = self.convert_timestamp_to_beijing(formatted_post[field])
                # 替换原字段为可读格式
                formatted_post[field] = formatted_post[f"{field}_beijing"]
        
        return formatted_post
    
    def export_posts_today(self, format_type: str = 'json') -> str:
        """导出今日采集的帖子数据"""
        # 获取今日数据
        today = datetime.now(self.beijing_tz).strftime('%Y-%m-%d')
        
        sql = """
        SELECT * FROM reddit_ai_posts 
        WHERE crawl_date = ? 
        ORDER BY score DESC
        """
        
        result = self.db.execute_query(sql, [today])
        
        if not result.get('success', False):
            return f"查询失败: {result}"
        
        posts = result.get('results', [])
        
        if not posts:
            return f"今日({today})暂无数据"
        
        # 格式化时间
        formatted_posts = [self.format_post_data(post) for post in posts]
        
        if format_type.lower() == 'csv':
            return self._export_to_csv(formatted_posts, f"reddit_ai_posts_{today}")
        else:
            return self._export_to_json(formatted_posts, f"reddit_ai_posts_{today}")
    
    def export_posts_by_date_range(self, start_date: str, end_date: str, format_type: str = 'json') -> str:
        """导出指定日期范围的帖子数据"""
        sql = """
        SELECT * FROM reddit_ai_posts 
        WHERE crawl_date BETWEEN ? AND ? 
        ORDER BY crawl_date DESC, score DESC
        """
        
        result = self.db.execute_query(sql, [start_date, end_date])
        
        if not result.get('success', False):
            return f"查询失败: {result}"
        
        posts = result.get('results', [])
        
        if not posts:
            return f"日期范围({start_date} 到 {end_date})暂无数据"
        
        # 格式化时间
        formatted_posts = [self.format_post_data(post) for post in posts]
        
        filename = f"reddit_ai_posts_{start_date}_to_{end_date}"
        
        if format_type.lower() == 'csv':
            return self._export_to_csv(formatted_posts, filename)
        else:
            return self._export_to_json(formatted_posts, filename)
    
    def export_top_posts(self, limit: int = 100, format_type: str = 'json') -> str:
        """导出评分最高的帖子"""
        sql = """
        SELECT * FROM reddit_ai_posts 
        ORDER BY score DESC 
        LIMIT ?
        """
        
        result = self.db.execute_query(sql, [limit])
        
        if not result.get('success', False):
            return f"查询失败: {result}"
        
        posts = result.get('results', [])
        
        if not posts:
            return "暂无数据"
        
        # 格式化时间
        formatted_posts = [self.format_post_data(post) for post in posts]
        
        filename = f"reddit_ai_top_{limit}_posts"
        
        if format_type.lower() == 'csv':
            return self._export_to_csv(formatted_posts, filename)
        else:
            return self._export_to_json(formatted_posts, filename)
    
    def export_posts_by_subreddit(self, subreddit: str, format_type: str = 'json') -> str:
        """导出指定社区的帖子数据"""
        sql = """
        SELECT * FROM reddit_ai_posts 
        WHERE subreddit = ? 
        ORDER BY created_utc DESC
        """
        
        result = self.db.execute_query(sql, [subreddit])
        
        if not result.get('success', False):
            return f"查询失败: {result}"
        
        posts = result.get('results', [])
        
        if not posts:
            return f"社区 r/{subreddit} 暂无数据"
        
        # 格式化时间
        formatted_posts = [self.format_post_data(post) for post in posts]
        
        filename = f"reddit_ai_{subreddit}_posts"
        
        if format_type.lower() == 'csv':
            return self._export_to_csv(formatted_posts, filename)
        else:
            return self._export_to_json(formatted_posts, filename)
    
    def _export_to_json(self, data: List[Dict], filename: str) -> str:
        """导出为JSON格式"""
        filepath = f"/Users/momo/Desktop/reddit 爬虫/exports/{filename}.json"
        
        try:
            # 确保导出目录存在
            import os
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump({
                    "export_info": {
                        "total_records": len(data),
                        "export_time": datetime.now(self.beijing_tz).strftime('%Y-%m-%d %H:%M:%S CST'),
                        "timezone": "Asia/Shanghai (CST)",
                        "note": "所有时间戳已转换为北京时间"
                    },
                    "posts": data
                }, f, ensure_ascii=False, indent=2)
            
            return f"✅ 成功导出 {len(data)} 条记录到: {filepath}"
        
        except Exception as e:
            return f"❌ 导出失败: {e}"
    
    def _export_to_csv(self, data: List[Dict], filename: str) -> str:
        """导出为CSV格式"""
        if not data:
            return "没有数据可导出"
        
        filepath = f"/Users/momo/Desktop/reddit 爬虫/exports/{filename}.csv"
        
        try:
            # 确保导出目录存在
            import os
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            # 获取所有字段名
            fieldnames = list(data[0].keys())
            
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(data)
            
            return f"✅ 成功导出 {len(data)} 条记录到: {filepath}"
        
        except Exception as e:
            return f"❌ 导出失败: {e}"
    
    def view_posts_summary(self, limit: int = 10) -> str:
        """查看帖子摘要（控制台友好格式）"""
        sql = """
        SELECT id, title, subreddit, score, num_comments, 
               created_utc, crawl_date, ai_category
        FROM reddit_ai_posts 
        ORDER BY crawl_timestamp DESC 
        LIMIT ?
        """
        
        result = self.db.execute_query(sql, [limit])
        
        if not result.get('success', False):
            return f"查询失败: {result}"
        
        posts = result.get('results', [])
        
        if not posts:
            return "暂无数据"
        
        # 格式化输出
        output = []
        output.append(f"\n📊 最新 {len(posts)} 条帖子摘要")
        output.append("=" * 80)
        
        for i, post in enumerate(posts, 1):
            # 转换时间
            beijing_time = self.convert_timestamp_to_beijing(post.get('created_utc', 0))
            
            output.append(f"\n{i}. 【r/{post.get('subreddit', 'Unknown')}】{post.get('title', '无标题')[:60]}")
            output.append(f"   📈 评分: {post.get('score', 0)} | 💬 评论: {post.get('num_comments', 0)} | 🏷️ 分类: {post.get('ai_category', '未分类')}")
            output.append(f"   🕐 发布时间: {beijing_time} | 📅 采集日期: {post.get('crawl_date', '未知')}")
            output.append(f"   🆔 ID: {post.get('id', 'Unknown')}")
        
        output.append("\n" + "=" * 80)
        output.append(f"💡 提示: 使用 export_posts_today() 导出完整数据")
        
        return "\n".join(output)
    
    def get_statistics_with_beijing_time(self) -> str:
        """获取统计信息（北京时间格式）"""
        # 总帖子数
        total_result = self.db.execute_query("SELECT COUNT(*) as total FROM reddit_ai_posts")
        total_posts = total_result.get('results', [{}])[0].get('total', 0) if total_result.get('success') else 0
        
        # 今日帖子数
        today = datetime.now(self.beijing_tz).strftime('%Y-%m-%d')
        today_result = self.db.execute_query("SELECT COUNT(*) as today_total FROM reddit_ai_posts WHERE crawl_date = ?", [today])
        today_posts = today_result.get('results', [{}])[0].get('today_total', 0) if today_result.get('success') else 0
        
        # 最新帖子时间
        latest_result = self.db.execute_query("SELECT MAX(created_utc) as latest_time FROM reddit_ai_posts")
        latest_timestamp = latest_result.get('results', [{}])[0].get('latest_time', 0) if latest_result.get('success') else 0
        latest_time = self.convert_timestamp_to_beijing(latest_timestamp)
        
        # 按社区统计
        subreddit_result = self.db.execute_query("""
            SELECT subreddit, COUNT(*) as count 
            FROM reddit_ai_posts 
            GROUP BY subreddit 
            ORDER BY count DESC 
            LIMIT 10
        """)
        subreddit_stats = subreddit_result.get('results', []) if subreddit_result.get('success') else []
        
        # 按日期统计
        date_result = self.db.execute_query("""
            SELECT crawl_date, COUNT(*) as daily_count 
            FROM reddit_ai_posts 
            GROUP BY crawl_date 
            ORDER BY crawl_date DESC 
            LIMIT 7
        """)
        date_stats = date_result.get('results', []) if date_result.get('success') else []
        
        # 格式化输出
        output = []
        output.append(f"\n📊 Reddit AI数据库统计报告")
        output.append(f"🕐 生成时间: {datetime.now(self.beijing_tz).strftime('%Y-%m-%d %H:%M:%S CST')}")
        output.append("=" * 60)
        
        output.append(f"\n📈 基础统计:")
        output.append(f"   总帖子数: {total_posts:,} 条")
        output.append(f"   今日采集: {today_posts} 条 ({today})")
        output.append(f"   最新帖子: {latest_time}")
        
        if subreddit_stats:
            output.append(f"\n🎯 社区分布 (Top 10):")
            for stat in subreddit_stats:
                output.append(f"   r/{stat.get('subreddit', 'Unknown')}: {stat.get('count', 0)} 条")
        
        if date_stats:
            output.append(f"\n📅 每日采集统计 (最近7天):")
            for stat in date_stats:
                output.append(f"   {stat.get('crawl_date', 'Unknown')}: {stat.get('daily_count', 0)} 条")
        
        output.append("\n" + "=" * 60)
        
        return "\n".join(output)

def main():
    """主函数 - 交互式数据查看和导出"""
    exporter = DataExporter()
    
    print("🚀 Reddit AI 数据导出工具")
    print("📅 所有时间戳自动转换为北京时间格式")
    print("=" * 50)
    
    while True:
        print("\n可用操作:")
        print("1. 查看最新帖子摘要")
        print("2. 导出今日数据 (JSON)")
        print("3. 导出今日数据 (CSV)")
        print("4. 导出指定日期范围数据")
        print("5. 导出评分最高帖子")
        print("6. 导出指定社区数据")
        print("7. 查看数据库统计")
        print("8. 退出")
        
        choice = input("\n请选择操作 (1-8): ").strip()
        
        try:
            if choice == '1':
                limit = input("显示条数 (默认10): ").strip() or "10"
                result = exporter.view_posts_summary(int(limit))
                print(result)
                
            elif choice == '2':
                result = exporter.export_posts_today('json')
                print(result)
                
            elif choice == '3':
                result = exporter.export_posts_today('csv')
                print(result)
                
            elif choice == '4':
                start_date = input("开始日期 (YYYY-MM-DD): ").strip()
                end_date = input("结束日期 (YYYY-MM-DD): ").strip()
                format_type = input("格式 (json/csv, 默认json): ").strip() or "json"
                result = exporter.export_posts_by_date_range(start_date, end_date, format_type)
                print(result)
                
            elif choice == '5':
                limit = input("导出条数 (默认100): ").strip() or "100"
                format_type = input("格式 (json/csv, 默认json): ").strip() or "json"
                result = exporter.export_top_posts(int(limit), format_type)
                print(result)
                
            elif choice == '6':
                subreddit = input("社区名称 (如: ChatGPT): ").strip()
                format_type = input("格式 (json/csv, 默认json): ").strip() or "json"
                result = exporter.export_posts_by_subreddit(subreddit, format_type)
                print(result)
                
            elif choice == '7':
                result = exporter.get_statistics_with_beijing_time()
                print(result)
                
            elif choice == '8':
                print("👋 再见！")
                break
                
            else:
                print("❌ 无效选择，请重试")
                
        except ValueError as e:
            print(f"❌ 输入错误: {e}")
        except Exception as e:
            print(f"❌ 操作失败: {e}")

if __name__ == "__main__":
    main()
