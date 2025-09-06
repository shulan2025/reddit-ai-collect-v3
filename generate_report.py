#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reddit AI采集系统 - 详细数据分析报告生成器
"""

import requests
import json
from datetime import datetime, timedelta
import pytz

def get_comprehensive_report():
    """生成综合数据分析报告"""
    
    headers = {
        'Authorization': 'Bearer WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU',
        'Content-Type': 'application/json'
    }
    
    url = 'https://api.cloudflare.com/client/v4/accounts/e23dc8a212c55fe9210b99f24be11eb9/d1/database/3d1a2cff-14ac-49e7-9bfd-b4a5606c9712/query'
    
    beijing_tz = pytz.timezone('Asia/Shanghai')
    current_time = datetime.now(beijing_tz)
    
    print("📊 Reddit AI内容采集系统 - 综合数据报告")
    print("=" * 60)
    print(f"📅 报告生成时间: {current_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print()
    
    # 1. 总体统计
    print("🎯 1. 总体采集统计")
    print("-" * 30)
    
    data = {'sql': 'SELECT COUNT(*) as total FROM reddit_ai_posts'}
    response = requests.post(url, headers=headers, json=data)
    total_count = response.json()['result'][0]['results'][0]['total']
    
    data = {'sql': 'SELECT AVG(quality_score) as avg_quality FROM reddit_ai_posts'}
    response = requests.post(url, headers=headers, json=data)
    avg_quality = response.json()['result'][0]['results'][0]['avg_quality']
    
    data = {'sql': 'SELECT AVG(score) as avg_score FROM reddit_ai_posts'}
    response = requests.post(url, headers=headers, json=data)
    avg_score = response.json()['result'][0]['results'][0]['avg_score']
    
    print(f"📈 累计采集帖子: {total_count} 个")
    print(f"⭐ 平均质量分数: {avg_quality:.1f}/100")
    print(f"🔥 平均热度分数: {avg_score:.0f}")
    print()
    
    # 2. 内容质量分析
    print("🎨 2. 内容质量分析")
    print("-" * 30)
    
    data = {'sql': '''
        SELECT 
            CASE 
                WHEN quality_score >= 80 THEN "🏆 卓越"
                WHEN quality_score >= 70 THEN "⭐ 优秀"
                WHEN quality_score >= 60 THEN "✅ 良好"
                WHEN quality_score >= 50 THEN "📝 合格"
                ELSE "🔧 待提升"
            END as quality_level,
            COUNT(*) as count,
            ROUND(AVG(score), 1) as avg_reddit_score
        FROM reddit_ai_posts 
        GROUP BY quality_level
        ORDER BY MIN(quality_score) DESC
    '''}
    response = requests.post(url, headers=headers, json=data)
    quality_levels = response.json()['result'][0]['results']
    
    for level in quality_levels:
        count = level['count']
        percentage = (count / total_count) * 100
        avg_reddit_score = level['avg_reddit_score']
        print(f"   {level['quality_level']}: {count} 个 ({percentage:.1f}%) | 平均热度: {avg_reddit_score}")
    print()
    
    # 3. AI技术领域分析
    print("🤖 3. AI技术领域分析")
    print("-" * 30)
    
    data = {'sql': '''
        SELECT 
            ai_category, 
            COUNT(*) as count,
            ROUND(AVG(quality_score), 1) as avg_quality,
            ROUND(AVG(score), 0) as avg_score,
            MAX(score) as max_score
        FROM reddit_ai_posts 
        WHERE ai_category IS NOT NULL AND ai_category != ""
        GROUP BY ai_category 
        ORDER BY count DESC
    '''}
    response = requests.post(url, headers=headers, json=data)
    categories = response.json()['result'][0]['results']
    
    for cat in categories:
        count = cat['count']
        percentage = (count / total_count) * 100
        print(f"   🔸 {cat['ai_category']}: {count} 个 ({percentage:.1f}%)")
        print(f"      质量: {cat['avg_quality']}/100 | 热度: {cat['avg_score']} | 最高: {cat['max_score']}")
    print()
    
    # 4. 子版块表现分析
    print("📍 4. 子版块表现分析")
    print("-" * 30)
    
    data = {'sql': '''
        SELECT 
            subreddit,
            COUNT(*) as count,
            ROUND(AVG(quality_score), 1) as avg_quality,
            ROUND(AVG(score), 0) as avg_score,
            MAX(score) as max_score,
            ROUND(AVG(num_comments), 1) as avg_comments
        FROM reddit_ai_posts 
        GROUP BY subreddit 
        ORDER BY count DESC
    '''}
    response = requests.post(url, headers=headers, json=data)
    subreddits = response.json()['result'][0]['results']
    
    for sub in subreddits:
        count = sub['count']
        percentage = (count / total_count) * 100
        print(f"   📌 r/{sub['subreddit']}: {count} 个 ({percentage:.1f}%)")
        print(f"      质量: {sub['avg_quality']}/100 | 热度: {sub['avg_score']} | 最高: {sub['max_score']} | 评论: {sub['avg_comments']}")
    print()
    
    # 5. 热门内容TOP榜
    print("🏆 5. 热门内容TOP 15")
    print("-" * 30)
    
    data = {'sql': '''
        SELECT title, subreddit, score, quality_score, ai_category, num_comments
        FROM reddit_ai_posts 
        ORDER BY score DESC 
        LIMIT 15
    '''}
    response = requests.post(url, headers=headers, json=data)
    top_posts = response.json()['result'][0]['results']
    
    for i, post in enumerate(top_posts, 1):
        title = post['title'][:50] + '...' if len(post['title']) > 50 else post['title']
        print(f"   {i:2d}. {title}")
        print(f"       📍 r/{post['subreddit']} | 📈 {post['score']:,} 分 | 💬 {post['num_comments']} 评论")
        print(f"       ⭐ 质量: {post['quality_score']:.1f} | 🏷️ {post['ai_category']}")
        print()
    
    # 6. 系统性能指标
    print("⚡ 6. 系统性能指标")
    print("-" * 30)
    
    # 计算采集效率
    data = {'sql': '''
        SELECT 
            COUNT(DISTINCT subreddit) as covered_subreddits,
            COUNT(*) as total_posts,
            ROUND(AVG(score), 0) as avg_engagement
        FROM reddit_ai_posts
    '''}
    response = requests.post(url, headers=headers, json=data)
    performance = response.json()['result'][0]['results'][0]
    
    # 计算高质量比例
    data = {'sql': 'SELECT COUNT(*) as high_quality FROM reddit_ai_posts WHERE quality_score >= 70'}
    response = requests.post(url, headers=headers, json=data)
    high_quality_count = response.json()['result'][0]['results'][0]['high_quality']
    
    high_quality_rate = (high_quality_count / total_count) * 100
    
    print(f"   🎯 社区覆盖率: {performance['covered_subreddits']}/17 个目标社区")
    print(f"   📊 采集总量: {performance['total_posts']} 个帖子")
    print(f"   ⭐ 高质量率: {high_quality_rate:.1f}% (70分以上)")
    print(f"   🔥 平均参与度: {performance['avg_engagement']} (Reddit分数)")
    print()
    
    # 7. 数据完整性检查
    print("🔍 7. 数据完整性检查")
    print("-" * 30)
    
    # 检查缺失字段
    data = {'sql': '''
        SELECT 
            COUNT(CASE WHEN title IS NULL OR title = "" THEN 1 END) as missing_title,
            COUNT(CASE WHEN ai_category IS NULL OR ai_category = "" THEN 1 END) as missing_category,
            COUNT(CASE WHEN quality_score IS NULL OR quality_score = 0 THEN 1 END) as missing_quality
        FROM reddit_ai_posts
    '''}
    response = requests.post(url, headers=headers, json=data)
    integrity = response.json()['result'][0]['results'][0]
    
    print(f"   📝 标题完整性: {total_count - integrity['missing_title']}/{total_count} ({((total_count - integrity['missing_title'])/total_count)*100:.1f}%)")
    print(f"   🏷️ 分类完整性: {total_count - integrity['missing_category']}/{total_count} ({((total_count - integrity['missing_category'])/total_count)*100:.1f}%)")
    print(f"   ⭐ 质量评分完整性: {total_count - integrity['missing_quality']}/{total_count} ({((total_count - integrity['missing_quality'])/total_count)*100:.1f}%)")
    print()
    
    # 8. 下一步建议
    print("💡 8. 系统优化建议")
    print("-" * 30)
    
    if total_count < 200:
        print(f"   🎯 扩大采集规模: 当前{total_count}个，建议调整至200个目标")
    
    if high_quality_rate < 80:
        print(f"   ⭐ 提升质量过滤: 当前高质量率{high_quality_rate:.1f}%，建议优化评分算法")
    
    if performance['covered_subreddits'] < 10:
        print(f"   📍 扩展社区覆盖: 当前{performance['covered_subreddits']}个，建议增加更多AI社区")
    
    print(f"   🔄 定期清理: 建议设置30天数据保留期")
    print(f"   📊 趋势分析: 建议添加周/月趋势对比")
    print()
    
    print("✅ 报告生成完成！")
    print(f"🚀 下次自动采集: 明日 06:00 北京时间")

if __name__ == "__main__":
    get_comprehensive_report()
