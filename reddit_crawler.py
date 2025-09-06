#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reddit AI 内容爬虫主程序
每日北京时间早上6点执行，采集200条AI相关帖子
"""

import praw
import time
import logging
import uuid
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
import pytz

from config import REDDIT_CONFIG, COLLECTION_CONFIG, validate_config
from database_manager import D1DatabaseManager
from content_processor import ContentProcessor
from daily_collection_config import TARGET_SUBREDDITS, get_collection_date
from time_filter_config import is_within_time_limit, calculate_time_quality_score
from time_utils import (
    beijing_now, beijing_timestamp, format_beijing_time, 
    reddit_to_beijing, today_date, log_time_format
)

class RedditAICrawler:
    """Reddit AI 内容爬虫"""
    
    def __init__(self):
        # 验证配置
        validate_config()
        
        # 初始化组件
        self.reddit = self._init_reddit_client()
        self.db = D1DatabaseManager()
        self.processor = ContentProcessor()
        
        # 设置日志
        self.logger = self._setup_logging()
        
        # 北京时区
        self.beijing_tz = pytz.timezone('Asia/Shanghai')
        
        # 统计信息
        self.stats = {
            "session_id": str(uuid.uuid4()),
            "start_time": time.time(),
            "total_fetched": 0,
            "total_processed": 0,
            "total_stored": 0,
            "api_calls": 0,
            "errors": []
        }
    
    def _init_reddit_client(self) -> praw.Reddit:
        """初始化Reddit客户端"""
        try:
            reddit = praw.Reddit(
                client_id=REDDIT_CONFIG["client_id"],
                client_secret=REDDIT_CONFIG["client_secret"],
                user_agent=REDDIT_CONFIG["user_agent"]
            )
            
            # 测试连接
            reddit.user.me()
            return reddit
            
        except Exception as e:
            raise ValueError(f"Reddit API连接失败: {e}")
    
    def _setup_logging(self) -> logging.Logger:
        """设置日志"""
        logger = logging.getLogger(__name__)
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            # 文件日志
            fh = logging.FileHandler(f'reddit_crawler_{date.today().strftime("%Y%m%d")}.log')
            fh.setLevel(logging.INFO)
            
            # 控制台日志
            ch = logging.StreamHandler()
            ch.setLevel(logging.INFO)
            
            # 格式化
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            fh.setFormatter(formatter)
            ch.setFormatter(formatter)
            
            logger.addHandler(fh)
            logger.addHandler(ch)
        
        return logger
    
    def collect_daily_posts(self) -> bool:
        """执行每日帖子采集"""
        try:
            collection_date = today_date()
            current_time = beijing_now()
            self.logger.info(f"开始每日采集任务 - 日期: {collection_date} ({current_time.strftime('%H:%M:%S CST')})")
            
            # 创建每日任务记录
            self.db.create_daily_task(collection_date, COLLECTION_CONFIG["daily_target"])
            self.db.update_daily_task_status(collection_date, "running")
            
            # 检查今日已采集数量
            today_count = self.db.get_today_post_count()
            remaining_target = COLLECTION_CONFIG["daily_target"] - today_count
            
            if remaining_target <= 0:
                self.logger.info(f"今日目标已完成，已采集 {today_count} 个帖子")
                self.db.update_daily_task_status(collection_date, "completed", today_count)
                return True
            
            self.logger.info(f"今日已采集: {today_count}, 剩余目标: {remaining_target}")
            
            # 获取今日各子版块统计
            subreddit_stats = self.db.get_today_posts_by_subreddit()
            
            # 执行采集
            total_collected = 0
            for subreddit_config in TARGET_SUBREDDITS:
                subreddit_name = subreddit_config["name"]
                target_posts = subreddit_config["target_posts"]
                
                # 检查该子版块今日已采集数量
                already_collected = subreddit_stats.get(subreddit_name, 0)
                needed = max(0, target_posts - already_collected)
                
                if needed == 0:
                    self.logger.info(f"r/{subreddit_name} 今日目标已完成 ({already_collected}/{target_posts})")
                    continue
                
                self.logger.info(f"开始采集 r/{subreddit_name} - 目标: {needed} 个帖子")
                
                collected = self._collect_subreddit_posts(subreddit_config, needed)
                total_collected += collected
                
                self.logger.info(f"r/{subreddit_name} 采集完成: {collected} 个帖子")
                
                # 达到总目标后停止
                current_total = self.db.get_today_post_count()
                if current_total >= COLLECTION_CONFIG["daily_target"]:
                    self.logger.info(f"已达到每日目标 {COLLECTION_CONFIG['daily_target']} 个帖子")
                    break
                
                # API调用间隔
                time.sleep(2)
            
            # 更新任务状态
            final_count = self.db.get_today_post_count()
            self.db.update_daily_task_status(collection_date, "completed", final_count)
            
            self.logger.info(f"每日采集任务完成 - 总计采集: {final_count} 个帖子")
            return True
            
        except Exception as e:
            self.logger.error(f"每日采集任务失败: {e}")
            self.db.update_daily_task_status(
                get_collection_date(), 
                "failed", 
                error_message=str(e)
            )
            return False
    
    def _collect_subreddit_posts(self, subreddit_config: Dict, target_count: int) -> int:
        """采集单个子版块的帖子"""
        subreddit_name = subreddit_config["name"]
        sort_methods = subreddit_config.get("sort_methods", ["hot"])
        min_score = subreddit_config.get("min_score", 10)
        min_comments = subreddit_config.get("min_comments", 3)
        
        collected_count = 0
        
        try:
            subreddit = self.reddit.subreddit(subreddit_name)
            self.stats["api_calls"] += 1
            
            for sort_method in sort_methods:
                if collected_count >= target_count:
                    break
                
                self.logger.info(f"  采集 r/{subreddit_name} - {sort_method} 排序")
                
                # 获取帖子
                posts = self._get_posts_by_sort(subreddit, sort_method, limit=100)
                
                for post in posts:
                    if collected_count >= target_count:
                        break
                    
                    # 检查是否符合条件
                    if not self._should_collect_post(post, min_score, min_comments):
                        continue
                    
                    # 检查今日是否已存在
                    if self.db.check_post_exists_today(post.id):
                        continue
                    
                    # 处理和存储帖子
                    if self._process_and_store_post(post, subreddit_name):
                        collected_count += 1
                        self.stats["total_stored"] += 1
                        
                        if collected_count % 10 == 0:
                            self.logger.info(f"    已采集 {collected_count}/{target_count} 个帖子")
                
                # 排序方法间隔
                time.sleep(1)
            
        except Exception as e:
            self.logger.error(f"采集 r/{subreddit_name} 失败: {e}")
            self.stats["errors"].append(f"r/{subreddit_name}: {str(e)}")
        
        return collected_count
    
    def _get_posts_by_sort(self, subreddit, sort_method: str, limit: int = 100):
        """根据排序方式获取帖子"""
        self.stats["api_calls"] += 1
        
        if sort_method == "hot":
            return subreddit.hot(limit=limit)
        elif sort_method == "top":
            return subreddit.top(time_filter="week", limit=limit)
        elif sort_method == "new":
            return subreddit.new(limit=limit)
        elif sort_method == "rising":
            return subreddit.rising(limit=limit)
        else:
            return subreddit.hot(limit=limit)
    
    def _should_collect_post(self, post, min_score: int, min_comments: int) -> bool:
        """检查帖子是否应该被采集"""
        try:
            # 基本筛选条件
            if post.score < min_score:
                return False
            
            if post.num_comments < min_comments:
                return False
            
            if post.upvote_ratio < 0.6:
                return False
            
            # 排除某些类型的帖子
            if post.over_18:  # NSFW
                return False
            
            if post.removed_by_category:  # 已删除
                return False
            
            if "[deleted]" in (post.title or ""):
                return False
            
            # 时间限制检查
            is_valid, reason = is_within_time_limit(post.created_utc, "hot")
            if not is_valid:
                return False
            
            # AI相关性检查
            title = getattr(post, 'title', '')
            content = getattr(post, 'selftext', '')
            
            is_ai, category, keywords = self.processor.is_ai_related(title, content)
            if not is_ai:
                return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"检查帖子条件时出错: {e}")
            return False
    
    def _process_and_store_post(self, post, subreddit_name: str) -> bool:
        """处理并存储帖子"""
        try:
            self.stats["total_processed"] += 1
            
            # 提取基本信息
            post_data = self._extract_post_data(post, subreddit_name)
            
            # 计算质量评分
            quality_score = self.processor.calculate_quality_score(post_data)
            post_data["quality_score"] = quality_score
            
            # 时间质量加权
            time_weighted_score = calculate_time_quality_score(
                post_data["created_utc"], 
                quality_score
            )
            post_data["tech_relevance_score"] = min(10.0, time_weighted_score / 10)
            
            # AI分类
            classification = self.processor.classify_content(
                post_data["title"], 
                post_data["selftext"]
            )
            post_data["ai_category"] = classification["primary_category"]
            post_data["content_category"] = classification["content_type"]
            
            # 存储帖子
            if not self.db.insert_post(post_data):
                return False
            
            # 提取和存储关键词
            keywords = self.processor.extract_all_keywords(
                post_data["title"], 
                post_data["selftext"]
            )
            
            if keywords:
                self.db.insert_keywords(post_data["id"], keywords[:20])  # 最多20个关键词
            
            # 存储技术分类
            self.db.insert_tech_category(post_data["id"], classification)
            
            return True
            
        except Exception as e:
            self.logger.error(f"处理帖子失败 {post.id}: {e}")
            return False
    
    def _extract_post_data(self, post, subreddit_name: str) -> Dict:
        """提取帖子数据"""
        return {
            "id": post.id,
            "permalink": f"https://reddit.com{post.permalink}",
            "url": getattr(post, 'url', None),
            "title": getattr(post, 'title', ''),
            "selftext": getattr(post, 'selftext', ''),
            "selftext_html": getattr(post, 'selftext_html', None),
            "score": getattr(post, 'score', 0),
            "upvote_ratio": getattr(post, 'upvote_ratio', 0.0),
            "num_comments": getattr(post, 'num_comments', 0),
            "total_awards_received": getattr(post, 'total_awards_received', 0),
            "num_crossposts": getattr(post, 'num_crossposts', 0),
            "author": str(getattr(post, 'author', 'unknown')),
            "subreddit": subreddit_name,
            "subreddit_subscribers": getattr(post.subreddit, 'subscribers', 0),
            "created_utc": int(getattr(post, 'created_utc', time.time())),
            "is_self": getattr(post, 'is_self', False),
            "is_video": getattr(post, 'is_video', False),
            "over_18": getattr(post, 'over_18', False),
            "locked": getattr(post, 'locked', False),
            "stickied": getattr(post, 'stickied', False),
        }
    
    def get_collection_summary(self) -> Dict:
        """获取采集汇总信息"""
        end_time = time.time()
        duration = end_time - self.stats["start_time"]
        
        today_count = self.db.get_today_post_count()
        subreddit_stats = self.db.get_today_posts_by_subreddit()
        
        return {
            "session_id": self.stats["session_id"],
            "duration_seconds": round(duration, 2),
            "total_fetched": self.stats["total_fetched"],
            "total_processed": self.stats["total_processed"],
            "total_stored": self.stats["total_stored"],
            "api_calls": self.stats["api_calls"],
            "today_total": today_count,
            "target_achievement": f"{today_count}/{COLLECTION_CONFIG['daily_target']}",
            "subreddit_breakdown": subreddit_stats,
            "errors": self.stats["errors"]
        }

def main():
    """主程序入口"""
    print("Reddit AI 内容每日采集系统")
    print("=" * 50)
    
    try:
        # 初始化爬虫
        crawler = RedditAICrawler()
        
        # 执行采集
        success = crawler.collect_daily_posts()
        
        # 输出汇总
        summary = crawler.get_collection_summary()
        
        print("\n采集汇总:")
        print(f"  执行时间: {summary['duration_seconds']} 秒")
        print(f"  今日总计: {summary['today_total']} 个帖子")
        print(f"  目标完成度: {summary['target_achievement']}")
        print(f"  API调用数: {summary['api_calls']}")
        
        if summary['subreddit_breakdown']:
            print("\n各子版块统计:")
            for subreddit, count in summary['subreddit_breakdown'].items():
                print(f"    r/{subreddit}: {count} 个帖子")
        
        if summary['errors']:
            print(f"\n错误数量: {len(summary['errors'])}")
            for error in summary['errors'][:5]:  # 显示前5个错误
                print(f"    {error}")
        
        print(f"\n采集状态: {'✅ 成功' if success else '❌ 失败'}")
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ 程序执行失败: {e}")
        return 1

if __name__ == "__main__":
    import sys
    sys.exit(main())
