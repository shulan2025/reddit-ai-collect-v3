#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cloudflare D1 数据库管理器
负责所有数据库操作，包括帖子存储、查询、去重等
"""

import json
import time
import requests
import logging
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from config import DATABASE_CONFIG
from time_utils import (
    beijing_now, beijing_timestamp, format_beijing_time, 
    today_date, log_time_format, db_time_format
)

class D1DatabaseManager:
    """Cloudflare D1 数据库管理器"""
    
    def __init__(self):
        self.api_token = DATABASE_CONFIG["api_token"]
        self.account_id = DATABASE_CONFIG["account_id"] 
        self.database_id = DATABASE_CONFIG["database_id"]
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/d1/database/{self.database_id}"
        
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        self.logger = logging.getLogger(__name__)
    
    def execute_query(self, sql: str, params: List = None) -> Dict:
        """执行SQL查询"""
        try:
            data = {
                "sql": sql
            }
            if params:
                data["params"] = params
            
            response = requests.post(
                f"{self.base_url}/query",
                headers=self.headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    return result["result"][0] if result.get("result") else {}
                else:
                    self.logger.error(f"D1查询失败: {result}")
                    return {}
            else:
                self.logger.error(f"D1 API请求失败: {response.status_code} - {response.text}")
                return {}
                
        except Exception as e:
            self.logger.error(f"数据库查询异常: {e}")
            return {}
    
    def insert_post(self, post_data: Dict) -> bool:
        """插入单个帖子数据"""
        try:
            sql = """
            INSERT OR IGNORE INTO reddit_ai_posts (
                id, permalink, url, title, selftext,
                score, upvote_ratio, num_comments,
                author, subreddit, created_utc,
                quality_score, ai_category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            params = [
                post_data.get("id"),
                post_data.get("permalink"),
                post_data.get("url"),
                post_data.get("title"),
                post_data.get("selftext"),
                post_data.get("score", 0),
                post_data.get("upvote_ratio", 0.0),
                post_data.get("num_comments", 0),
                post_data.get("author"),
                post_data.get("subreddit"),
                post_data.get("created_utc"),
                post_data.get("quality_score", 0.0),
                post_data.get("ai_category")
            ]
            
            result = self.execute_query(sql, params)
            
            if result.get("changes", 0) > 0:
                self.logger.info(f"成功插入帖子: {post_data.get('id')} - {post_data.get('title')[:50]}")
                return True
            else:
                self.logger.debug(f"帖子已存在或插入失败: {post_data.get('id')}")
                return False
                
        except Exception as e:
            self.logger.error(f"插入帖子数据异常: {e}")
            return False
    
    def batch_insert_posts(self, posts_data: List[Dict]) -> Tuple[int, int]:
        """批量插入帖子数据"""
        success_count = 0
        total_count = len(posts_data)
        
        for post_data in posts_data:
            if self.insert_post(post_data):
                success_count += 1
        
        self.logger.info(f"批量插入完成: {success_count}/{total_count}")
        return success_count, total_count
    
    def check_post_exists_today(self, post_id: str) -> bool:
        """检查帖子今天是否已存在"""
        sql = """
        SELECT COUNT(*) as count FROM reddit_ai_posts 
        WHERE id = ? AND crawl_date = date('now')
        """
        
        result = self.execute_query(sql, [post_id])
        return result.get("results", [{}])[0].get("count", 0) > 0
    
    def get_today_post_count(self) -> int:
        """获取今日已采集帖子数量"""
        sql = """
        SELECT COUNT(*) as count FROM reddit_ai_posts 
        WHERE crawl_date = date('now')
        """
        
        result = self.execute_query(sql)
        return result.get("results", [{}])[0].get("count", 0)
    
    def get_today_posts_by_subreddit(self) -> Dict[str, int]:
        """获取今日各子版块采集统计"""
        sql = """
        SELECT subreddit, COUNT(*) as count 
        FROM reddit_ai_posts 
        WHERE crawl_date = date('now')
        GROUP BY subreddit
        ORDER BY count DESC
        """
        
        result = self.execute_query(sql)
        stats = {}
        
        for row in result.get("results", []):
            stats[row["subreddit"]] = row["count"]
        
        return stats
    
    def insert_keywords(self, post_id: str, keywords: List[Dict]) -> int:
        """插入关键词数据"""
        success_count = 0
        
        for keyword_data in keywords:
            sql = """
            INSERT INTO reddit_post_keywords (
                post_id, keyword, category, confidence_score, 
                extraction_method, keyword_type, frequency, position
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            params = [
                post_id,
                keyword_data.get("keyword"),
                keyword_data.get("category"),
                keyword_data.get("confidence_score", 0.0),
                keyword_data.get("extraction_method", "auto"),
                keyword_data.get("keyword_type", "general"),
                keyword_data.get("frequency", 1),
                keyword_data.get("position", "content")
            ]
            
            result = self.execute_query(sql, params)
            if result.get("changes", 0) > 0:
                success_count += 1
        
        return success_count
    
    def insert_tech_category(self, post_id: str, category_data: Dict) -> bool:
        """插入技术分类数据"""
        sql = """
        INSERT INTO reddit_post_tech_categories (
            post_id, primary_category, secondary_categories, confidence_score,
            classification_model, tech_stack, application_domain, complexity_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        params = [
            post_id,
            category_data.get("primary_category"),
            json.dumps(category_data.get("secondary_categories", [])),
            category_data.get("confidence_score", 0.0),
            category_data.get("classification_model", "rule_based"),
            json.dumps(category_data.get("tech_stack", {})),
            category_data.get("application_domain"),
            category_data.get("complexity_level", "medium")
        ]
        
        result = self.execute_query(sql, params)
        return result.get("changes", 0) > 0
    
    def create_daily_task(self, task_date: str, target_count: int = 200) -> bool:
        """创建每日采集任务"""
        sql = """
        INSERT OR IGNORE INTO reddit_daily_tasks (
            task_date, target_count
        ) VALUES (?, ?)
        """
        
        params = [task_date, target_count]
        result = self.execute_query(sql, params)
        return result.get("changes", 0) > 0
    
    def update_daily_task_status(self, task_date: str, status: str, 
                                actual_count: int = None, error_message: str = None) -> bool:
        """更新每日任务状态"""
        if actual_count is not None:
            sql = """
            UPDATE reddit_daily_tasks 
            SET task_status = ?, actual_count = ?, end_time = unixepoch()
            WHERE task_date = ?
            """
            params = [status, actual_count, task_date]
        else:
            sql = """
            UPDATE reddit_daily_tasks 
            SET task_status = ?
            WHERE task_date = ?
            """
            params = [status, task_date]
        
        result = self.execute_query(sql, params)
        return result.get("changes", 0) > 0
    
    def get_daily_task_status(self, task_date: str) -> Optional[Dict]:
        """获取每日任务状态"""
        sql = """
        SELECT * FROM reddit_daily_tasks WHERE task_date = ?
        """
        
        result = self.execute_query(sql, [task_date])
        results = result.get("results", [])
        return results[0] if results else None
    
    def log_crawl_session(self, session_data: Dict) -> bool:
        """记录采集会话日志"""
        sql = """
        INSERT INTO reddit_crawl_logs (
            crawl_session_id, subreddit, sort_method, start_time,
            total_fetched, total_processed, total_stored, status, api_calls_used
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        params = [
            session_data.get("session_id"),
            session_data.get("subreddit"),
            session_data.get("sort_method"),
            session_data.get("start_time"),
            session_data.get("total_fetched", 0),
            session_data.get("total_processed", 0),
            session_data.get("total_stored", 0),
            session_data.get("status", "completed"),
            session_data.get("api_calls_used", 0)
        ]
        
        result = self.execute_query(sql, params)
        return result.get("changes", 0) > 0
    
    def get_collection_stats(self, days: int = 7) -> Dict:
        """获取最近几天的采集统计"""
        sql = """
        SELECT 
            crawl_date,
            COUNT(*) as post_count,
            AVG(score) as avg_score,
            AVG(quality_score) as avg_quality,
            COUNT(DISTINCT subreddit) as subreddit_count
        FROM reddit_ai_posts 
        WHERE crawl_date >= date('now', '-{} days')
        GROUP BY crawl_date
        ORDER BY crawl_date DESC
        """.format(days)
        
        result = self.execute_query(sql)
        return result.get("results", [])
    
    def cleanup_old_data(self, days: int = 90) -> int:
        """清理旧数据"""
        sql = """
        DELETE FROM reddit_ai_posts 
        WHERE crawl_date < date('now', '-{} days')
        """.format(days)
        
        result = self.execute_query(sql)
        deleted_count = result.get("changes", 0)
        
        if deleted_count > 0:
            self.logger.info(f"清理了 {deleted_count} 条超过 {days} 天的旧数据")
        
        return deleted_count

if __name__ == "__main__":
    # 测试数据库连接
    logging.basicConfig(level=logging.INFO)
    
    db = D1DatabaseManager()
    
    # 测试基本查询
    result = db.execute_query("SELECT COUNT(*) as count FROM reddit_ai_posts")
    print(f"数据库连接测试: {result}")
    
    # 测试今日统计
    today_count = db.get_today_post_count()
    print(f"今日已采集帖子数: {today_count}")
    
    # 测试子版块统计
    subreddit_stats = db.get_today_posts_by_subreddit()
    print(f"今日各子版块统计: {subreddit_stats}")
