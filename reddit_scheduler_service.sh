#!/bin/bash

# Reddit AI 调度器服务管理脚本
# 用于在macOS/Linux系统上管理Reddit AI调度器

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAEMON_SCRIPT="$SCRIPT_DIR/start_scheduler_daemon.py"
SERVICE_NAME="reddit-ai-scheduler"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 检查Python环境
check_python() {
    if ! command -v python3 &> /dev/null; then
        print_message $RED "❌ Python3 未安装"
        return 1
    fi
    
    if [ ! -f "$DAEMON_SCRIPT" ]; then
        print_message $RED "❌ 守护进程脚本不存在: $DAEMON_SCRIPT"
        return 1
    fi
    
    return 0
}

# 启动服务
start_service() {
    print_message $BLUE "🚀 启动Reddit AI调度器服务..."
    
    if ! check_python; then
        return 1
    fi
    
    cd "$SCRIPT_DIR"
    
    # 启动守护进程监控
    nohup python3 "$DAEMON_SCRIPT" monitor > scheduler_monitor.log 2>&1 &
    
    # 保存监控进程PID
    echo $! > /tmp/reddit_scheduler_monitor.pid
    
    sleep 3
    
    # 检查是否启动成功
    if python3 "$DAEMON_SCRIPT" status | grep -q "运行中"; then
        print_message $GREEN "✅ Reddit AI调度器服务启动成功"
        print_message $BLUE "📊 服务状态:"
        python3 "$DAEMON_SCRIPT" status
        return 0
    else
        print_message $RED "❌ 服务启动失败"
        return 1
    fi
}

# 停止服务
stop_service() {
    print_message $BLUE "⏹️ 停止Reddit AI调度器服务..."
    
    cd "$SCRIPT_DIR"
    
    # 停止调度器
    python3 "$DAEMON_SCRIPT" stop
    
    # 停止监控进程
    if [ -f /tmp/reddit_scheduler_monitor.pid ]; then
        MONITOR_PID=$(cat /tmp/reddit_scheduler_monitor.pid)
        if ps -p $MONITOR_PID > /dev/null 2>&1; then
            kill $MONITOR_PID
            print_message $GREEN "✅ 监控进程已停止"
        fi
        rm -f /tmp/reddit_scheduler_monitor.pid
    fi
    
    print_message $GREEN "✅ Reddit AI调度器服务已停止"
}

# 重启服务
restart_service() {
    print_message $BLUE "🔄 重启Reddit AI调度器服务..."
    stop_service
    sleep 2
    start_service
}

# 查看状态
show_status() {
    print_message $BLUE "📊 Reddit AI调度器服务状态"
    echo "=================================="
    
    cd "$SCRIPT_DIR"
    
    # 守护进程状态
    python3 "$DAEMON_SCRIPT" status
    
    echo ""
    
    # 监控进程状态
    if [ -f /tmp/reddit_scheduler_monitor.pid ]; then
        MONITOR_PID=$(cat /tmp/reddit_scheduler_monitor.pid)
        if ps -p $MONITOR_PID > /dev/null 2>&1; then
            print_message $GREEN "✅ 监控进程运行中 (PID: $MONITOR_PID)"
        else
            print_message $RED "❌ 监控进程已停止"
        fi
    else
        print_message $YELLOW "⚠️ 监控进程未启动"
    fi
    
    echo ""
    print_message $BLUE "📋 最近日志:"
    if [ -f scheduler_daemon.log ]; then
        tail -5 scheduler_daemon.log
    else
        print_message $YELLOW "⚠️ 未找到日志文件"
    fi
}

# 查看日志
show_logs() {
    print_message $BLUE "📄 Reddit AI调度器日志"
    echo "=================================="
    
    cd "$SCRIPT_DIR"
    
    if [ -f scheduler_daemon.log ]; then
        tail -50 scheduler_daemon.log
    else
        print_message $YELLOW "⚠️ 未找到日志文件"
    fi
    
    echo ""
    
    if [ -f scheduler.log ]; then
        print_message $BLUE "📄 调度器运行日志:"
        tail -20 scheduler.log
    fi
}

# 测试运行
test_run() {
    print_message $BLUE "🧪 测试运行Reddit AI调度器..."
    
    cd "$SCRIPT_DIR"
    
    if ! check_python; then
        return 1
    fi
    
    # 手动执行一次采集
    python3 main.py collect
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "✅ 测试运行成功"
    else
        print_message $RED "❌ 测试运行失败"
    fi
}

# 安装为系统服务（macOS launchd）
install_macos_service() {
    print_message $BLUE "📦 安装为macOS系统服务..."
    
    SERVICE_PLIST="$HOME/Library/LaunchAgents/com.reddit.ai.scheduler.plist"
    
    cat > "$SERVICE_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.reddit.ai.scheduler</string>
    <key>ProgramArguments</key>
    <array>
        <string>$SCRIPT_DIR/reddit_scheduler_service.sh</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$SCRIPT_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>$SCRIPT_DIR/service_error.log</string>
    <key>StandardOutPath</key>
    <string>$SCRIPT_DIR/service_output.log</string>
</dict>
</plist>
EOF
    
    # 加载服务
    launchctl load "$SERVICE_PLIST"
    
    print_message $GREEN "✅ macOS服务安装完成"
    print_message $BLUE "💡 使用以下命令管理服务:"
    echo "  启动: launchctl start com.reddit.ai.scheduler"
    echo "  停止: launchctl stop com.reddit.ai.scheduler"
    echo "  卸载: launchctl unload $SERVICE_PLIST"
}

# 主函数
main() {
    case "$1" in
        start)
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        test)
            test_run
            ;;
        install-macos)
            install_macos_service
            ;;
        *)
            print_message $BLUE "Reddit AI 调度器服务管理"
            echo "==============================="
            echo "使用方法: $0 {start|stop|restart|status|logs|test|install-macos}"
            echo ""
            echo "命令说明:"
            echo "  start        - 启动调度器服务"
            echo "  stop         - 停止调度器服务"
            echo "  restart      - 重启调度器服务"
            echo "  status       - 查看服务状态"
            echo "  logs         - 查看运行日志"
            echo "  test         - 测试运行一次"
            echo "  install-macos - 安装为macOS系统服务"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
