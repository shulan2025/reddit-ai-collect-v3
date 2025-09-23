#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reddit AI调度器守护进程启动器
确保调度器能够持续在后台运行
"""

import os
import sys
import signal
import time
import logging
from datetime import datetime
import pytz
import subprocess
import json

class SchedulerDaemon:
    """调度器守护进程"""
    
    def __init__(self):
        self.pid_file = '/tmp/reddit_scheduler.pid'
        self.log_file = 'scheduler_daemon.log'
        self.beijing_tz = pytz.timezone('Asia/Shanghai')
        self.setup_logging()
        
    def setup_logging(self):
        """设置日志"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.log_file),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def is_running(self):
        """检查调度器是否在运行"""
        try:
            if os.path.exists(self.pid_file):
                with open(self.pid_file, 'r') as f:
                    pid = int(f.read().strip())
                
                # 检查进程是否存在
                try:
                    os.kill(pid, 0)
                    return True
                except OSError:
                    # 进程不存在，删除PID文件
                    os.remove(self.pid_file)
                    return False
            return False
        except Exception as e:
            self.logger.error(f"检查运行状态失败: {e}")
            return False
    
    def start_scheduler(self):
        """启动调度器"""
        if self.is_running():
            self.logger.info("调度器已在运行中")
            return True
        
        try:
            self.logger.info("启动Reddit AI调度器...")
            
            # 使用nohup启动调度器
            process = subprocess.Popen(
                [sys.executable, 'main.py', 'scheduler', 'start'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid  # 创建新的会话
            )
            
            # 保存PID
            with open(self.pid_file, 'w') as f:
                f.write(str(process.pid))
            
            self.logger.info(f"调度器已启动，PID: {process.pid}")
            
            # 等待一下确认启动成功
            time.sleep(3)
            
            if process.poll() is None:  # 进程仍在运行
                self.logger.info("✅ 调度器启动成功")
                return True
            else:
                self.logger.error("❌ 调度器启动失败")
                return False
                
        except Exception as e:
            self.logger.error(f"启动调度器失败: {e}")
            return False
    
    def stop_scheduler(self):
        """停止调度器"""
        try:
            if not self.is_running():
                self.logger.info("调度器未在运行")
                return True
            
            with open(self.pid_file, 'r') as f:
                pid = int(f.read().strip())
            
            self.logger.info(f"停止调度器 PID: {pid}")
            
            # 发送SIGTERM信号
            os.kill(pid, signal.SIGTERM)
            
            # 等待进程结束
            for _ in range(10):
                try:
                    os.kill(pid, 0)
                    time.sleep(1)
                except OSError:
                    break
            
            # 如果还没结束，强制杀死
            try:
                os.kill(pid, signal.SIGKILL)
            except OSError:
                pass
            
            # 删除PID文件
            if os.path.exists(self.pid_file):
                os.remove(self.pid_file)
            
            self.logger.info("✅ 调度器已停止")
            return True
            
        except Exception as e:
            self.logger.error(f"停止调度器失败: {e}")
            return False
    
    def restart_scheduler(self):
        """重启调度器"""
        self.logger.info("重启调度器...")
        self.stop_scheduler()
        time.sleep(2)
        return self.start_scheduler()
    
    def get_status(self):
        """获取状态"""
        beijing_time = datetime.now(self.beijing_tz)
        
        status = {
            "daemon_running": self.is_running(),
            "check_time": beijing_time.strftime('%Y-%m-%d %H:%M:%S CST'),
            "pid_file": self.pid_file,
            "log_file": self.log_file
        }
        
        if self.is_running():
            with open(self.pid_file, 'r') as f:
                status["pid"] = int(f.read().strip())
        
        return status
    
    def monitor_loop(self):
        """监控循环 - 确保调度器一直运行"""
        self.logger.info("启动调度器监控循环...")
        
        while True:
            try:
                if not self.is_running():
                    self.logger.warning("检测到调度器已停止，重新启动...")
                    if self.start_scheduler():
                        self.logger.info("调度器重启成功")
                    else:
                        self.logger.error("调度器重启失败，5分钟后重试")
                        time.sleep(300)  # 等待5分钟
                        continue
                
                # 每10分钟检查一次
                time.sleep(600)
                
            except KeyboardInterrupt:
                self.logger.info("收到停止信号，退出监控...")
                break
            except Exception as e:
                self.logger.error(f"监控循环异常: {e}")
                time.sleep(60)  # 1分钟后重试

def main():
    """主函数"""
    daemon = SchedulerDaemon()
    
    if len(sys.argv) < 2:
        print("使用方法:")
        print("  python3 start_scheduler_daemon.py start     # 启动调度器")
        print("  python3 start_scheduler_daemon.py stop      # 停止调度器")
        print("  python3 start_scheduler_daemon.py restart   # 重启调度器")
        print("  python3 start_scheduler_daemon.py status    # 查看状态")
        print("  python3 start_scheduler_daemon.py monitor   # 启动监控（确保一直运行）")
        return 1
    
    command = sys.argv[1]
    
    if command == "start":
        if daemon.start_scheduler():
            print("✅ 调度器启动成功")
            return 0
        else:
            print("❌ 调度器启动失败")
            return 1
    
    elif command == "stop":
        if daemon.stop_scheduler():
            print("✅ 调度器停止成功")
            return 0
        else:
            print("❌ 调度器停止失败")
            return 1
    
    elif command == "restart":
        if daemon.restart_scheduler():
            print("✅ 调度器重启成功")
            return 0
        else:
            print("❌ 调度器重启失败")
            return 1
    
    elif command == "status":
        status = daemon.get_status()
        print("Reddit AI 调度器守护进程状态")
        print("=" * 40)
        print(f"运行状态: {'✅ 运行中' if status['daemon_running'] else '❌ 已停止'}")
        print(f"检查时间: {status['check_time']}")
        if status.get('pid'):
            print(f"进程ID: {status['pid']}")
        print(f"PID文件: {status['pid_file']}")
        print(f"日志文件: {status['log_file']}")
        return 0
    
    elif command == "monitor":
        print("🔄 启动监控模式（确保调度器一直运行）")
        print("按 Ctrl+C 停止监控")
        daemon.monitor_loop()
        return 0
    
    else:
        print(f"未知命令: {command}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
