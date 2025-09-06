#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
北京时间数据查看器 - 快速查看数据库中的数据
所有时间戳自动转换为北京时间格式
"""

import pytz
from datetime import datetime
from database_manager import D1DatabaseManager

class BeijingTimeViewer:
    """北京时间数据查看器"""
    
    def __init__(self):
        self.db = D1DatabaseManager()
        self.beijing_tz = pytz.timezone('Asia/Shanghai')
        self.utc_tz = pytz.UTC
    
    def convert_timestamp(self, timestamp):
        """转换时间戳为北京时间"""
        if not timestamp:
            return "未知时间"
        
        try:
            utc_dt = datetime.fromtimestamp(timestamp, tz=self.utc_tz)
            beijing_dt = utc_dt.astimezone(self.beijing_tz)
            return beijing_dt.strftime('%Y-%m-%d %H:%M:%S CST')
        except:
            return "时间格式错误"
    
    def view_today_posts(self):
        """查看今日采集的帖子"""
        today = datetime.now(self.beijing_tz).strftime('%Y-%m-%d')
        
        sql = """
        SELECT id, title, subreddit, score, num_comments, 
               created_utc, ai_category, crawl_date
        FROM reddit_ai_posts 
        WHERE crawl_date = ? 
        ORDER BY score DESC
        LIMIT 20
        """
        
        result = self.db.execute_query(sql, [today])
        
        if not result.get('success', False):
            print(f"❌ 查询失败: {result}")
            return
        
        posts = result.get('results', [])
        
        if not posts:
            print(f"📅 今日({today})暂无数据")
            return
        
        print(f"\n📊 今日({today})采集数据 - 共 {len(posts)} 条")
        print("=" * 100)
        
        for i, post in enumerate(posts, 1):
            beijing_time = self.convert_timestamp(post.get('created_utc'))
            title = post.get('title', '无标题')[:50] + ('...' if len(post.get('title', '')) > 50 else '')
            
            print(f"{i:2d}. 【r/{post.get('subreddit')}】{title}")
            print(f"    📈 {post.get('score'):4d}分 | 💬 {post.get('num_comments'):3d}评论 | "
                  f"🏷️ {post.get('ai_category', '未分类')} | 🕐 {beijing_time}")
            print()
    
    def view_latest_posts(self, limit=10):
        """查看最新帖子"""
        sql = """
        SELECT id, title, subreddit, score, num_comments, 
               created_utc, ai_category, crawl_date
        FROM reddit_ai_posts 
        ORDER BY created_utc DESC
        LIMIT ?
        """
        
        result = self.db.execute_query(sql, [limit])
        
        if not result.get('success', False):
            print(f"❌ 查询失败: {result}")
            return
        
        posts = result.get('results', [])
        
        if not posts:
            print("📊 暂无数据")
            return
        
        print(f"\n🔥 最新 {len(posts)} 条帖子")
        print("=" * 100)
        
        for i, post in enumerate(posts, 1):
            beijing_time = self.convert_timestamp(post.get('created_utc'))
            title = post.get('title', '无标题')[:50] + ('...' if len(post.get('title', '')) > 50 else '')
            
            print(f"{i:2d}. 【r/{post.get('subreddit')}】{title}")
            print(f"    📈 {post.get('score'):4d}分 | 💬 {post.get('num_comments'):3d}评论 | "
                  f"🏷️ {post.get('ai_category', '未分类')} | 🕐 {beijing_time}")
            print()
    
    def view_top_posts(self, limit=10):
        """查看热门帖子"""
        sql = """
        SELECT id, title, subreddit, score, num_comments, 
               created_utc, ai_category, crawl_date
        FROM reddit_ai_posts 
        ORDER BY score DESC
        LIMIT ?
        """
        
        result = self.db.execute_query(sql, [limit])
        
        if not result.get('success', False):
            print(f"❌ 查询失败: {result}")
            return
        
        posts = result.get('results', [])
        
        if not posts:
            print("📊 暂无数据")
            return
        
        print(f"\n🏆 评分最高 {len(posts)} 条帖子")
        print("=" * 100)
        
        for i, post in enumerate(posts, 1):
            beijing_time = self.convert_timestamp(post.get('created_utc'))
            title = post.get('title', '无标题')[:50] + ('...' if len(post.get('title', '')) > 50 else '')
            
            print(f"{i:2d}. 【r/{post.get('subreddit')}】{title}")
            print(f"    📈 {post.get('score'):4d}分 | 💬 {post.get('num_comments'):3d}评论 | "
                  f"🏷️ {post.get('ai_category', '未分类')} | 🕐 {beijing_time}")
            print()
    
    def view_subreddit_stats(self):
        """查看社区统计"""
        sql = """
        SELECT subreddit, COUNT(*) as count, 
               AVG(score) as avg_score, MAX(score) as max_score
        FROM reddit_ai_posts 
        GROUP BY subreddit 
        ORDER BY count DESC
        """
        
        result = self.db.execute_query(sql)
        
        if not result.get('success', False):
            print(f"❌ 查询失败: {result}")
            return
        
        stats = result.get('results', [])
        
        if not stats:
            print("📊 暂无统计数据")
            return
        
        print(f"\n📈 社区采集统计")
        print("=" * 80)
        print(f"{'社区':15} {'帖子数':>8} {'平均分':>8} {'最高分':>8}")
        print("-" * 80)
        
        for stat in stats:
            print(f"r/{stat.get('subreddit', 'Unknown'):13} "
                  f"{stat.get('count', 0):8d} "
                  f"{stat.get('avg_score', 0):8.1f} "
                  f"{stat.get('max_score', 0):8d}")
    
    def view_daily_stats(self):
        """查看每日统计"""
        sql = """
        SELECT crawl_date, COUNT(*) as daily_count, 
               AVG(score) as avg_score, MAX(score) as max_score
        FROM reddit_ai_posts 
        GROUP BY crawl_date 
        ORDER BY crawl_date DESC
        LIMIT 10
        """
        
        result = self.db.execute_query(sql)
        
        if not result.get('success', False):
            print(f"❌ 查询失败: {result}")
            return
        
        stats = result.get('results', [])
        
        if not stats:
            print("📊 暂无统计数据")
            return
        
        print(f"\n📅 每日采集统计 (最近10天)")
        print("=" * 60)
        print(f"{'日期':12} {'帖子数':>8} {'平均分':>8} {'最高分':>8}")
        print("-" * 60)
        
        for stat in stats:
            print(f"{stat.get('crawl_date', 'Unknown'):12} "
                  f"{stat.get('daily_count', 0):8d} "
                  f"{stat.get('avg_score', 0):8.1f} "
                  f"{stat.get('max_score', 0):8d}")
    
    def view_full_stats(self):
        """查看完整统计信息"""
        # 总数统计
        total_result = self.db.execute_query("SELECT COUNT(*) as total FROM reddit_ai_posts")
        total_posts = total_result.get('results', [{}])[0].get('total', 0) if total_result.get('success') else 0
        
        # 今日统计
        today = datetime.now(self.beijing_tz).strftime('%Y-%m-%d')
        today_result = self.db.execute_query("SELECT COUNT(*) as today_total FROM reddit_ai_posts WHERE crawl_date = ?", [today])
        today_posts = today_result.get('results', [{}])[0].get('today_total', 0) if today_result.get('success') else 0
        
        # 时间范围
        time_range_result = self.db.execute_query("""
            SELECT MIN(created_utc) as earliest, MAX(created_utc) as latest 
            FROM reddit_ai_posts
        """)
        
        time_range = time_range_result.get('results', [{}])[0] if time_range_result.get('success') else {}
        earliest_time = self.convert_timestamp(time_range.get('earliest', 0))
        latest_time = self.convert_timestamp(time_range.get('latest', 0))
        
        # 评分统计
        score_result = self.db.execute_query("""
            SELECT AVG(score) as avg_score, MAX(score) as max_score, MIN(score) as min_score
            FROM reddit_ai_posts
        """)
        
        score_stats = score_result.get('results', [{}])[0] if score_result.get('success') else {}
        
        current_time = datetime.now(self.beijing_tz).strftime('%Y-%m-%d %H:%M:%S CST')
        
        print(f"\n📊 Reddit AI数据库完整统计")
        print(f"🕐 统计时间: {current_time}")
        print("=" * 60)
        print(f"📈 基础数据:")
        print(f"   总帖子数: {total_posts:,} 条")
        print(f"   今日采集: {today_posts} 条 ({today})")
        print(f"   最早帖子: {earliest_time}")
        print(f"   最新帖子: {latest_time}")
        print()
        print(f"📊 评分统计:")
        print(f"   平均评分: {score_stats.get('avg_score', 0):.1f}")
        print(f"   最高评分: {score_stats.get('max_score', 0):,}")
        print(f"   最低评分: {score_stats.get('min_score', 0):,}")
        print("=" * 60)

def main():
    """主函数"""
    viewer = BeijingTimeViewer()
    
    print("🚀 Reddit AI 数据查看器 (北京时间)")
    print("📅 所有时间自动转换为北京时间显示")
    print("=" * 50)
    
    while True:
        print("\n📋 可用操作:")
        print("1. 查看今日采集数据")
        print("2. 查看最新帖子")
        print("3. 查看热门帖子")
        print("4. 查看社区统计")
        print("5. 查看每日统计")
        print("6. 查看完整统计")
        print("7. 退出")
        
        choice = input("\n请选择操作 (1-7): ").strip()
        
        try:
            if choice == '1':
                viewer.view_today_posts()
                
            elif choice == '2':
                limit = input("显示条数 (默认10): ").strip()
                limit = int(limit) if limit.isdigit() else 10
                viewer.view_latest_posts(limit)
                
            elif choice == '3':
                limit = input("显示条数 (默认10): ").strip()
                limit = int(limit) if limit.isdigit() else 10
                viewer.view_top_posts(limit)
                
            elif choice == '4':
                viewer.view_subreddit_stats()
                
            elif choice == '5':
                viewer.view_daily_stats()
                
            elif choice == '6':
                viewer.view_full_stats()
                
            elif choice == '7':
                print("👋 再见！")
                break
                
            else:
                print("❌ 无效选择，请重试")
                
        except Exception as e:
            print(f"❌ 操作失败: {e}")

if __name__ == "__main__":
    main()
