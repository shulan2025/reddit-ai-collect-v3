#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reddit AI采集系统 - 持续监控面板
"""

import time
import os
import requests
import json
from datetime import datetime, timedelta
import pytz

def clear_screen():
    """清屏"""
    os.system('clear' if os.name == 'posix' else 'cls')

def get_system_status():
    """获取系统状态"""
    headers = {
        'Authorization': 'Bearer WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU',
        'Content-Type': 'application/json'
    }
    
    url = 'https://api.cloudflare.com/client/v4/accounts/e23dc8a212c55fe9210b99f24be11eb9/d1/database/3d1a2cff-14ac-49e7-9bfd-b4a5606c9712/query'
    
    try:
        # 获取今日统计
        data = {'sql': 'SELECT COUNT(*) as count FROM reddit_ai_posts WHERE date(crawl_timestamp, "unixepoch") = date("now")'}
        response = requests.post(url, headers=headers, json=data, timeout=10)
        today_count = response.json()['result'][0]['results'][0]['count']
        
        # 获取总计
        data = {'sql': 'SELECT COUNT(*) as count FROM reddit_ai_posts'}
        response = requests.post(url, headers=headers, json=data, timeout=10)
        total_count = response.json()['result'][0]['results'][0]['count']
        
        # 获取平均质量
        data = {'sql': 'SELECT ROUND(AVG(quality_score), 1) as avg_quality FROM reddit_ai_posts WHERE date(crawl_timestamp, "unixepoch") = date("now")'}
        response = requests.post(url, headers=headers, json=data, timeout=10)
        result = response.json()['result'][0]['results']
        avg_quality = result[0]['avg_quality'] if result and result[0]['avg_quality'] else 0
        
        # 获取子版块分布
        data = {'sql': '''
            SELECT subreddit, COUNT(*) as count 
            FROM reddit_ai_posts 
            WHERE date(crawl_timestamp, "unixepoch") = date("now")
            GROUP BY subreddit 
            ORDER BY count DESC 
            LIMIT 5
        '''}
        response = requests.post(url, headers=headers, json=data, timeout=10)
        subreddits = response.json()['result'][0]['results']
        
        return {
            'status': 'online',
            'today_count': today_count,
            'total_count': total_count,
            'avg_quality': avg_quality,
            'subreddits': subreddits,
            'target_progress': (today_count / 200) * 100
        }
        
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }

def display_monitor():
    """显示监控面板"""
    beijing_tz = pytz.timezone('Asia/Shanghai')
    
    while True:
        clear_screen()
        
        current_time = datetime.now(beijing_tz)
        status = get_system_status()
        
        print("🖥️  Reddit AI内容采集系统 - 实时监控面板")
        print("=" * 65)
        print(f"⏰ 当前时间: {current_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        print()
        
        if status['status'] == 'online':
            # 系统状态指示灯
            health_score = min(100, (status['today_count'] / 200) * 100 + (status['avg_quality'] / 100) * 50)
            
            if health_score >= 80:
                status_indicator = "🟢 优秀"
            elif health_score >= 60:
                status_indicator = "🟡 良好"
            elif health_score >= 40:
                status_indicator = "🟠 警告"
            else:
                status_indicator = "🔴 需要关注"
            
            print(f"📊 系统状态: {status_indicator} (健康度: {health_score:.0f}/100)")
            print()
            
            # 核心指标
            print("📈 核心采集指标")
            print("-" * 35)
            print(f"📅 今日采集: {status['today_count']}/200 ({status['target_progress']:.1f}%)")
            print(f"📊 累计总量: {status['total_count']} 个帖子")
            print(f"⭐ 平均质量: {status['avg_quality']}/100")
            
            # 进度条
            progress = int(status['target_progress'] / 5)  # 20个字符的进度条
            progress_bar = "█" * progress + "░" * (20 - progress)
            print(f"🎯 今日进度: [{progress_bar}] {status['target_progress']:.1f}%")
            print()
            
            # 子版块分布
            print("📍 活跃子版块 TOP 5")
            print("-" * 35)
            for i, sub in enumerate(status['subreddits'], 1):
                percentage = (sub['count'] / status['today_count']) * 100 if status['today_count'] > 0 else 0
                print(f"  {i}. r/{sub['subreddit']}: {sub['count']} 个 ({percentage:.1f}%)")
            print()
            
            # 下次采集时间
            tomorrow = current_time.replace(hour=6, minute=0, second=0, microsecond=0) + timedelta(days=1)
            time_to_next = tomorrow - current_time
            
            print("⏰ 调度信息")
            print("-" * 35)
            print(f"下次采集: {tomorrow.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            print(f"倒计时: {time_to_next}")
            print()
            
            # 系统建议
            print("💡 系统建议")
            print("-" * 35)
            
            if status['today_count'] < 100:
                print("⚠️  今日采集量偏低，建议检查采集配置")
            elif status['today_count'] >= 180:
                print("✅ 今日采集量充足，系统运行良好")
            
            if status['avg_quality'] < 60:
                print("⚠️  内容质量偏低，建议优化过滤规则")
            elif status['avg_quality'] >= 70:
                print("✅ 内容质量良好，过滤机制有效")
            
        else:
            print("🔴 系统状态: 离线")
            print(f"❌ 错误信息: {status.get('error', '未知错误')}")
        
        print()
        print("🔄 数据每30秒自动刷新 | Ctrl+C 退出监控")
        print("=" * 65)
        
        try:
            time.sleep(30)  # 30秒刷新一次
        except KeyboardInterrupt:
            print("\n👋 监控已退出")
            break

if __name__ == "__main__":
    print("🚀 启动Reddit AI内容采集系统监控...")
    time.sleep(2)
    display_monitor()
