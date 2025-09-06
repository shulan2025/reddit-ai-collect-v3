#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
每日定时调度器
负责每日北京时间早上6点执行Reddit AI内容采集任务
"""

import schedule
import time
import logging
import threading
from datetime import datetime, timedelta
import pytz
from typing import Optional

from reddit_crawler import RedditAICrawler
from database_manager import D1DatabaseManager
from daily_collection_config import get_collection_date, get_next_collection_time
from email_sender import EmailSender

class DailyScheduler:
    """每日定时调度器"""
    
    def __init__(self):
        self.beijing_tz = pytz.timezone('Asia/Shanghai')
        self.logger = self._setup_logging()
        self.db = D1DatabaseManager()
        self.email_sender = EmailSender()
        self.is_running = False
        self.current_job_thread: Optional[threading.Thread] = None
    
    def _setup_logging(self) -> logging.Logger:
        """设置日志"""
        logger = logging.getLogger('scheduler')
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            # 文件日志
            fh = logging.FileHandler('scheduler.log')
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
    
    def daily_collection_job(self):
        """每日采集任务"""
        collection_date = get_collection_date()
        beijing_time = datetime.now(self.beijing_tz)
        
        self.logger.info(f"开始执行每日采集任务 - {collection_date} {beijing_time.strftime('%H:%M:%S')}")
        
        # 检查是否已经有任务在运行
        if self.current_job_thread and self.current_job_thread.is_alive():
            self.logger.warning("上一个采集任务仍在运行，跳过本次执行")
            return
        
        # 检查今日任务状态
        task_status = self.db.get_daily_task_status(collection_date)
        if task_status and task_status.get("task_status") == "completed":
            self.logger.info(f"今日任务已完成，实际采集: {task_status.get('actual_count', 0)} 个帖子")
            return
        
        # 在新线程中执行采集任务
        self.current_job_thread = threading.Thread(
            target=self._execute_collection_task,
            args=(collection_date,),
            name=f"collection-{collection_date}"
        )
        self.current_job_thread.start()
    
    def _execute_collection_task(self, collection_date: str):
        """执行采集任务"""
        try:
            self.logger.info(f"启动采集线程 - {collection_date}")
            
            # 更新任务开始时间
            self.db.update_daily_task_status(collection_date, "running")
            
            # 创建爬虫实例并执行采集
            crawler = RedditAICrawler()
            success = crawler.collect_daily_posts()
            
            # 获取采集汇总
            summary = crawler.get_collection_summary()
            
            # 记录结果
            if success:
                self.logger.info(f"采集任务完成 - 今日总计: {summary['today_total']} 个帖子")
                self.db.update_daily_task_status(
                    collection_date, 
                    "completed", 
                    summary['today_total']
                )
            else:
                error_msg = f"采集失败，错误数: {len(summary['errors'])}"
                self.logger.error(error_msg)
                self.db.update_daily_task_status(
                    collection_date, 
                    "failed", 
                    summary['today_total'],
                    error_msg
                )
            
            # 记录采集会话日志
            self._log_collection_session(summary, success)
            
            # 发送每日报告邮件
            if success and summary['today_total'] > 0:
                try:
                    email_sent = self.email_sender.send_daily_report()
                    if email_sent:
                        self.logger.info("每日报告邮件发送成功")
                    else:
                        self.logger.warning("每日报告邮件发送失败")
                except Exception as e:
                    self.logger.error(f"邮件发送异常: {e}")
            
        except Exception as e:
            self.logger.error(f"采集任务执行异常: {e}")
            self.db.update_daily_task_status(
                collection_date, 
                "failed", 
                error_message=str(e)
            )
    
    def _log_collection_session(self, summary: dict, success: bool):
        """记录采集会话日志"""
        try:
            session_data = {
                "session_id": summary["session_id"],
                "subreddit": "multiple",  # 多个子版块
                "sort_method": "mixed",   # 混合排序方式
                "start_time": int(time.time() - summary["duration_seconds"]),
                "total_fetched": summary.get("total_fetched", 0),
                "total_processed": summary.get("total_processed", 0),
                "total_stored": summary.get("total_stored", 0),
                "status": "completed" if success else "failed",
                "api_calls_used": summary.get("api_calls", 0)
            }
            
            self.db.log_crawl_session(session_data)
            
        except Exception as e:
            self.logger.error(f"记录采集会话失败: {e}")
    
    def setup_daily_schedule(self):
        """设置每日调度任务"""
        # 每日北京时间6点执行
        schedule.every().day.at("06:00").do(self.daily_collection_job).tag('daily_collection')
        
        # 添加一个测试任务（可选，用于调试）
        # schedule.every().minute.do(self.test_job).tag('test')
        
        self.logger.info("每日调度任务已设置 - 北京时间每日06:00执行")
        
        # 显示下次执行时间
        next_run = get_next_collection_time()
        self.logger.info(f"下次执行时间: {next_run.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    
    def test_job(self):
        """测试任务（用于调试）"""
        beijing_time = datetime.now(self.beijing_tz)
        self.logger.info(f"测试任务执行 - {beijing_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 检查系统状态
        today_count = self.db.get_today_post_count()
        self.logger.info(f"今日已采集帖子数: {today_count}")
    
    def run_scheduler(self):
        """启动调度器"""
        self.is_running = True
        self.logger.info("Reddit AI 每日采集调度器启动")
        
        try:
            while self.is_running:
                schedule.run_pending()
                time.sleep(60)  # 每分钟检查一次
                
        except KeyboardInterrupt:
            self.logger.info("收到停止信号，正在关闭调度器...")
            self.stop_scheduler()
        except Exception as e:
            self.logger.error(f"调度器运行异常: {e}")
            self.stop_scheduler()
    
    def stop_scheduler(self):
        """停止调度器"""
        self.is_running = False
        schedule.clear()
        
        # 等待当前任务完成
        if self.current_job_thread and self.current_job_thread.is_alive():
            self.logger.info("等待当前采集任务完成...")
            self.current_job_thread.join(timeout=300)  # 最多等待5分钟
        
        self.logger.info("调度器已停止")
    
    def run_once_now(self):
        """立即执行一次采集任务（用于测试）"""
        self.logger.info("手动执行采集任务")
        self.daily_collection_job()
    
    def get_schedule_status(self) -> dict:
        """获取调度状态"""
        beijing_time = datetime.now(self.beijing_tz)
        next_run = get_next_collection_time()
        
        # 获取今日任务状态
        today_task = self.db.get_daily_task_status(get_collection_date())
        
        status = {
            "scheduler_running": self.is_running,
            "current_time": beijing_time.strftime('%Y-%m-%d %H:%M:%S %Z'),
            "next_run_time": next_run.strftime('%Y-%m-%d %H:%M:%S %Z'),
            "time_until_next_run": str(next_run - beijing_time),
            "job_thread_active": self.current_job_thread and self.current_job_thread.is_alive(),
            "today_task_status": today_task.get("task_status") if today_task else "pending",
            "today_collected_count": self.db.get_today_post_count(),
            "scheduled_jobs": len(schedule.jobs)
        }
        
        return status

class SchedulerManager:
    """调度器管理类"""
    
    def __init__(self):
        self.scheduler = DailyScheduler()
    
    def start_daemon(self):
        """以守护进程方式启动"""
        import daemon
        import daemon.pidfile
        
        pidfile = daemon.pidfile.PIDLockFile('/tmp/reddit_scheduler.pid')
        
        with daemon.DaemonContext(
            pidfile=pidfile,
            working_directory='/tmp',
            umask=0o002,
        ):
            self.scheduler.setup_daily_schedule()
            self.scheduler.run_scheduler()
    
    def start_foreground(self):
        """前台启动"""
        self.scheduler.setup_daily_schedule()
        self.scheduler.run_scheduler()
    
    def status(self):
        """显示状态"""
        status = self.scheduler.get_schedule_status()
        
        print("Reddit AI 采集调度器状态")
        print("=" * 40)
        print(f"调度器运行状态: {'✅ 运行中' if status['scheduler_running'] else '❌ 已停止'}")
        print(f"当前时间: {status['current_time']}")
        print(f"下次执行时间: {status['next_run_time']}")
        print(f"距离下次执行: {status['time_until_next_run']}")
        print(f"采集任务运行中: {'是' if status['job_thread_active'] else '否'}")
        print(f"今日任务状态: {status['today_task_status']}")
        print(f"今日已采集: {status['today_collected_count']} 个帖子")
        print(f"调度任务数量: {status['scheduled_jobs']}")
    
    def run_now(self):
        """立即运行一次"""
        print("立即执行采集任务...")
        self.scheduler.run_once_now()

def main():
    """主程序入口"""
    import sys
    
    if len(sys.argv) < 2:
        print("使用方法:")
        print("  python scheduler.py start     # 前台启动调度器")
        print("  python scheduler.py daemon    # 后台启动调度器")
        print("  python scheduler.py status    # 显示状态")
        print("  python scheduler.py run       # 立即执行一次")
        return 1
    
    command = sys.argv[1]
    manager = SchedulerManager()
    
    if command == "start":
        print("启动Reddit AI采集调度器...")
        manager.start_foreground()
    
    elif command == "daemon":
        print("后台启动Reddit AI采集调度器...")
        manager.start_daemon()
    
    elif command == "status":
        manager.status()
    
    elif command == "run":
        manager.run_now()
    
    else:
        print(f"未知命令: {command}")
        return 1
    
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
