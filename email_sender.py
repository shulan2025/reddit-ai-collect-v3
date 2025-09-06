#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
邮件发送模块 - 自动发送每日分析报告
支持HTML格式邮件，包含详细的数据分析和图表
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import os
from datetime import datetime
import pytz
from typing import Dict, List, Optional
import json
from database_manager import D1DatabaseManager

class EmailSender:
    """邮件发送器"""
    
    def __init__(self):
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.sender_email = os.getenv("SENDER_EMAIL")  # 发送者邮箱
        self.sender_password = os.getenv("SENDER_PASSWORD")  # 应用专用密码
        self.recipient_email = "xiaoyan.chen222@gmail.com"
        self.beijing_tz = pytz.timezone('Asia/Shanghai')
        self.db = D1DatabaseManager()
    
    def convert_timestamp(self, timestamp):
        """转换时间戳为北京时间"""
        if not timestamp:
            return "未知时间"
        try:
            utc_dt = datetime.fromtimestamp(timestamp, tz=pytz.UTC)
            beijing_dt = utc_dt.astimezone(self.beijing_tz)
            return beijing_dt.strftime('%Y-%m-%d %H:%M:%S')
        except:
            return "时间格式错误"
    
    def generate_daily_report_data(self) -> Dict:
        """生成每日报告数据"""
        today = datetime.now(self.beijing_tz).strftime('%Y-%m-%d')
        
        # 今日基础统计
        today_stats = self.db.execute_query("""
            SELECT COUNT(*) as count, AVG(score) as avg_score, 
                   MAX(score) as max_score, SUM(num_comments) as total_comments
            FROM reddit_ai_posts WHERE crawl_date = ?
        """, [today])
        
        today_data = today_stats.get('results', [{}])[0] if today_stats.get('success') else {}
        
        # 今日热门帖子TOP 10
        top_posts = self.db.execute_query("""
            SELECT title, subreddit, score, num_comments, 
                   created_utc, ai_category, url
            FROM reddit_ai_posts 
            WHERE crawl_date = ?
            ORDER BY score DESC LIMIT 10
        """, [today])
        
        hot_posts = top_posts.get('results', []) if top_posts.get('success') else []
        
        # 社区分布
        community_stats = self.db.execute_query("""
            SELECT subreddit, COUNT(*) as count, AVG(score) as avg_score
            FROM reddit_ai_posts 
            WHERE crawl_date = ?
            GROUP BY subreddit 
            ORDER BY count DESC
        """, [today])
        
        communities = community_stats.get('results', []) if community_stats.get('success') else []
        
        # AI分类统计
        ai_categories = self.db.execute_query("""
            SELECT ai_category, COUNT(*) as count, AVG(score) as avg_score
            FROM reddit_ai_posts 
            WHERE crawl_date = ? AND ai_category IS NOT NULL
            GROUP BY ai_category 
            ORDER BY count DESC
        """, [today])
        
        categories = ai_categories.get('results', []) if ai_categories.get('success') else []
        
        return {
            "date": today,
            "basic_stats": today_data,
            "hot_posts": hot_posts,
            "communities": communities,
            "ai_categories": categories
        }
    
    def generate_html_report(self, data: Dict) -> str:
        """生成HTML格式的报告"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }}
                .container {{ max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }}
                .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }}
                .stat-card {{ background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #667eea; }}
                .stat-number {{ font-size: 24px; font-weight: bold; color: #667eea; }}
                .stat-label {{ color: #6c757d; font-size: 14px; }}
                .section {{ margin: 25px 0; }}
                .section-title {{ color: #333; border-bottom: 2px solid #667eea; padding-bottom: 5px; margin-bottom: 15px; }}
                .post-item {{ background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; }}
                .post-title {{ font-weight: bold; color: #333; margin-bottom: 5px; }}
                .post-meta {{ color: #6c757d; font-size: 14px; }}
                .community-item, .category-item {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }}
                .emoji {{ font-size: 18px; }}
                .footer {{ text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #6c757d; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚀 Reddit AI 每日数据报告</h1>
                    <p>📅 {data['date']} | 🕐 {datetime.now(self.beijing_tz).strftime('%H:%M:%S')} CST</p>
                </div>
                
                <div class="section">
                    <h2 class="section-title">📊 今日数据概览</h2>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-number">{data['basic_stats'].get('count', 0)}</div>
                            <div class="stat-label">📈 采集帖子</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">{data['basic_stats'].get('avg_score', 0):.0f}</div>
                            <div class="stat-label">⭐ 平均评分</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">{data['basic_stats'].get('max_score', 0):,}</div>
                            <div class="stat-label">🔥 最高评分</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">{data['basic_stats'].get('total_comments', 0):,}</div>
                            <div class="stat-label">💬 总评论数</div>
                        </div>
                    </div>
                </div>
        """
        
        # 热门帖子
        if data['hot_posts']:
            html += """
                <div class="section">
                    <h2 class="section-title">🏆 今日热门帖子 TOP 10</h2>
            """
            for i, post in enumerate(data['hot_posts'], 1):
                beijing_time = self.convert_timestamp(post.get('created_utc'))
                title = post.get('title', '无标题')[:80] + ('...' if len(post.get('title', '')) > 80 else '')
                html += f"""
                    <div class="post-item">
                        <div class="post-title">{i}. {title}</div>
                        <div class="post-meta">
                            📍 r/{post.get('subreddit')} | 
                            📈 {post.get('score', 0):,} 分 | 
                            💬 {post.get('num_comments', 0)} 评论 | 
                            🏷️ {post.get('ai_category', '未分类')} | 
                            🕐 {beijing_time}
                        </div>
                    </div>
                """
            html += "</div>"
        
        # 社区分布
        if data['communities']:
            html += """
                <div class="section">
                    <h2 class="section-title">🎯 社区分布统计</h2>
            """
            for comm in data['communities']:
                html += f"""
                    <div class="community-item">
                        <span>📌 r/{comm.get('subreddit')}</span>
                        <span>{comm.get('count')} 条 (平均 {comm.get('avg_score', 0):.0f} 分)</span>
                    </div>
                """
            html += "</div>"
        
        # AI分类
        if data['ai_categories']:
            html += """
                <div class="section">
                    <h2 class="section-title">🤖 AI技术领域分布</h2>
            """
            for cat in data['ai_categories']:
                html += f"""
                    <div class="category-item">
                        <span>🔸 {cat.get('ai_category')}</span>
                        <span>{cat.get('count')} 条 (平均 {cat.get('avg_score', 0):.0f} 分)</span>
                    </div>
                """
            html += "</div>"
        
        html += f"""
                <div class="footer">
                    <p>🤖 Reddit AI内容采集系统自动生成</p>
                    <p>📊 数据来源: Reddit API | 💾 存储: Cloudflare D1</p>
                    <p>🕐 下次采集: 明日 06:00 北京时间</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html
    
    def send_daily_report(self) -> bool:
        """发送每日报告邮件"""
        if not self.sender_email or not self.sender_password:
            print("❌ 邮件配置缺失，请设置 SENDER_EMAIL 和 SENDER_PASSWORD 环境变量")
            return False
        
        try:
            # 生成报告数据
            report_data = self.generate_daily_report_data()
            
            if report_data['basic_stats'].get('count', 0) == 0:
                print(f"❌ 今日({report_data['date']})暂无数据，跳过邮件发送")
                return False
            
            # 创建邮件
            message = MIMEMultipart("alternative")
            message["Subject"] = f"📊 Reddit AI 每日报告 - {report_data['date']}"
            message["From"] = self.sender_email
            message["To"] = self.recipient_email
            
            # 生成HTML内容
            html_content = self.generate_html_report(report_data)
            
            # 生成文本内容（简化版）
            text_content = f"""
Reddit AI 每日数据报告 - {report_data['date']}

📊 今日概览:
- 采集帖子: {report_data['basic_stats'].get('count', 0)} 条
- 平均评分: {report_data['basic_stats'].get('avg_score', 0):.0f} 分
- 最高评分: {report_data['basic_stats'].get('max_score', 0):,} 分
- 总评论数: {report_data['basic_stats'].get('total_comments', 0):,} 条

🏆 热门帖子 TOP 5:
"""
            
            for i, post in enumerate(report_data['hot_posts'][:5], 1):
                beijing_time = self.convert_timestamp(post.get('created_utc'))
                text_content += f"{i}. {post.get('title', '无标题')[:60]}\n"
                text_content += f"   r/{post.get('subreddit')} | {post.get('score', 0):,}分 | {beijing_time}\n\n"
            
            text_content += "\n🤖 Reddit AI内容采集系统自动生成"
            
            # 添加邮件内容
            part1 = MIMEText(text_content, "plain", "utf-8")
            part2 = MIMEText(html_content, "html", "utf-8")
            
            message.attach(part1)
            message.attach(part2)
            
            # 发送邮件
            context = ssl.create_default_context()
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls(context=context)
                server.login(self.sender_email, self.sender_password)
                server.sendmail(self.sender_email, self.recipient_email, message.as_string())
            
            print(f"✅ 每日报告已发送到 {self.recipient_email}")
            print(f"📊 包含 {report_data['basic_stats'].get('count', 0)} 条帖子数据")
            return True
            
        except Exception as e:
            print(f"❌ 邮件发送失败: {e}")
            return False
    
    def send_test_email(self) -> bool:
        """发送测试邮件"""
        if not self.sender_email or not self.sender_password:
            print("❌ 邮件配置缺失，请设置 SENDER_EMAIL 和 SENDER_PASSWORD 环境变量")
            return False
        
        try:
            message = MIMEMultipart()
            message["Subject"] = "🧪 Reddit AI 邮件系统测试"
            message["From"] = self.sender_email
            message["To"] = self.recipient_email
            
            body = f"""
Hello!

这是 Reddit AI 内容采集系统的邮件测试。

🕐 测试时间: {datetime.now(self.beijing_tz).strftime('%Y-%m-%d %H:%M:%S CST')}
📧 发送至: {self.recipient_email}
🤖 系统状态: 正常运行

如果你收到这封邮件，说明邮件系统配置成功！

下一步，系统将在每日 06:00 北京时间自动发送数据报告。

Best regards,
Reddit AI 采集系统
            """
            
            message.attach(MIMEText(body, "plain", "utf-8"))
            
            context = ssl.create_default_context()
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls(context=context)
                server.login(self.sender_email, self.sender_password)
                server.sendmail(self.sender_email, self.recipient_email, message.as_string())
            
            print(f"✅ 测试邮件已发送到 {self.recipient_email}")
            return True
            
        except Exception as e:
            print(f"❌ 测试邮件发送失败: {e}")
            return False

def main():
    """主函数 - 邮件发送测试"""
    sender = EmailSender()
    
    print("📧 Reddit AI 邮件发送系统")
    print("=" * 40)
    
    while True:
        print("\n可用操作:")
        print("1. 发送测试邮件")
        print("2. 发送今日报告")
        print("3. 检查邮件配置")
        print("4. 退出")
        
        choice = input("\n请选择操作 (1-4): ").strip()
        
        if choice == '1':
            sender.send_test_email()
            
        elif choice == '2':
            sender.send_daily_report()
            
        elif choice == '3':
            print(f"\n📧 邮件配置检查:")
            print(f"发送邮箱: {'✅ 已配置' if sender.sender_email else '❌ 未配置'}")
            print(f"发送密码: {'✅ 已配置' if sender.sender_password else '❌ 未配置'}")
            print(f"接收邮箱: {sender.recipient_email}")
            print(f"SMTP服务器: {sender.smtp_server}:{sender.smtp_port}")
            
        elif choice == '4':
            print("👋 再见！")
            break
            
        else:
            print("❌ 无效选择，请重试")

if __name__ == "__main__":
    main()
