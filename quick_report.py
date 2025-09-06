#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速数据报告查看器
"""

import pytz
from datetime import datetime
from database_manager import D1DatabaseManager

def quick_summary():
    """快速数据摘要"""
    db = D1DatabaseManager()
    beijing_tz = pytz.timezone('Asia/Shanghai')
    
    def convert_time(timestamp):
        if not timestamp:
            return "未知"
        try:
            utc_dt = datetime.fromtimestamp(timestamp, tz=pytz.UTC)
            beijing_dt = utc_dt.astimezone(beijing_tz)
            return beijing_dt.strftime('%m-%d %H:%M')
        except:
            return "时间错误"
    
    # 今日数据
    today = datetime.now(beijing_tz).strftime('%Y-%m-%d')
    today_result = db.execute_query("""
        SELECT COUNT(*) as count, AVG(score) as avg_score, MAX(score) as max_score
        FROM reddit_ai_posts WHERE crawl_date = ?
    """, [today])
    
    today_data = today_result.get('results', [{}])[0] if today_result.get('success') else {}
    
    # 总数据
    total_result = db.execute_query("""
        SELECT COUNT(*) as total, AVG(score) as avg_score, 
               MIN(created_utc) as earliest, MAX(created_utc) as latest
        FROM reddit_ai_posts
    """)
    
    total_data = total_result.get('results', [{}])[0] if total_result.get('success') else {}
    
    # Top 5 今日热门
    top_today = db.execute_query("""
        SELECT title, subreddit, score, num_comments, created_utc
        FROM reddit_ai_posts 
        WHERE crawl_date = ?
        ORDER BY score DESC LIMIT 5
    """, [today])
    
    top_posts = top_today.get('results', []) if top_today.get('success') else []
    
    # 社区统计
    subreddit_stats = db.execute_query("""
        SELECT subreddit, COUNT(*) as count
        FROM reddit_ai_posts 
        WHERE crawl_date = ?
        GROUP BY subreddit 
        ORDER BY count DESC
    """, [today])
    
    communities = subreddit_stats.get('results', []) if subreddit_stats.get('success') else []
    
    print(f"🚀 Reddit AI数据快速报告")
    print(f"📅 {today} | {datetime.now(beijing_tz).strftime('%H:%M:%S CST')}")
    print("=" * 50)
    
    print(f"📊 今日概览:")
    print(f"   📈 采集数量: {today_data.get('count', 0)} 条")
    print(f"   ⭐ 平均评分: {today_data.get('avg_score', 0):.1f}")
    print(f"   🔥 最高评分: {today_data.get('max_score', 0):,}")
    
    print(f"\n📈 累计数据:")
    print(f"   📊 总帖子数: {total_data.get('total', 0):,} 条")
    print(f"   ⭐ 平均评分: {total_data.get('avg_score', 0):.1f}")
    print(f"   🕐 数据范围: {convert_time(total_data.get('earliest'))} - {convert_time(total_data.get('latest'))}")
    
    if communities:
        print(f"\n🎯 今日社区分布:")
        for i, comm in enumerate(communities[:5], 1):
            print(f"   {i}. r/{comm.get('subreddit')}: {comm.get('count')} 条")
    
    if top_posts:
        print(f"\n🏆 今日热门TOP 5:")
        for i, post in enumerate(top_posts, 1):
            title = post.get('title', '')[:40] + ('...' if len(post.get('title', '')) > 40 else '')
            print(f"   {i}. {title}")
            print(f"      r/{post.get('subreddit')} | {post.get('score'):,}分 | {post.get('num_comments')}评论")
    
    print("=" * 50)

if __name__ == "__main__":
    quick_summary()
