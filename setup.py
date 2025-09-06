#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reddit AI 内容采集系统安装和配置脚本
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

def check_python_version():
    """检查Python版本"""
    if sys.version_info < (3, 8):
        print("❌ 需要Python 3.8或更高版本")
        return False
    
    print(f"✅ Python版本: {sys.version.split()[0]}")
    return True

def install_dependencies():
    """安装依赖包"""
    print("📦 安装依赖包...")
    
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ 依赖包安装完成")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ 依赖包安装失败: {e}")
        return False

def setup_environment_file():
    """设置环境变量文件"""
    env_example = Path(".env.example")
    env_file = Path(".env")
    
    if not env_example.exists():
        print("⚠️ .env.example 文件不存在，创建默认配置...")
        
        default_env = """# Reddit API 配置
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=Reddit_AI_Daily_Collector_v1.0

# Cloudflare D1 数据库配置
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
D1_DATABASE_ID=your_d1_database_id

# 采集配置
DAILY_TARGET_POSTS=200
COLLECTION_HOUR=6
COLLECTION_TIMEZONE=Asia/Shanghai
ENABLE_DAILY_DEDUP=true
MAX_RETRIES=3
RETRY_INTERVAL=300

# 调试配置
DEBUG_MODE=false
LOG_LEVEL=INFO
ENABLE_CONSOLE_OUTPUT=true
"""
        with open(".env.example", "w", encoding="utf-8") as f:
            f.write(default_env)
    
    if not env_file.exists():
        shutil.copy(".env.example", ".env")
        print("✅ 环境配置文件已创建: .env")
        print("⚠️ 请编辑 .env 文件，填入你的API密钥")
        return False
    else:
        print("✅ 环境配置文件已存在: .env")
        return True

def download_nltk_data():
    """下载NLTK数据"""
    print("📚 下载NLTK数据...")
    
    try:
        import nltk
        nltk.download('punkt', quiet=True)
        nltk.download('stopwords', quiet=True)
        print("✅ NLTK数据下载完成")
        return True
    except Exception as e:
        print(f"⚠️ NLTK数据下载失败: {e}")
        return False

def create_directories():
    """创建必要的目录"""
    directories = ["logs", "data", "temp"]
    
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
    
    print(f"✅ 创建目录: {', '.join(directories)}")

def test_configuration():
    """测试配置"""
    print("🧪 测试配置...")
    
    try:
        from config import validate_config
        validate_config()
        print("✅ 配置验证通过")
        return True
    except Exception as e:
        print(f"❌ 配置验证失败: {e}")
        print("请检查 .env 文件中的配置")
        return False

def create_systemd_service():
    """创建systemd服务文件 (Linux)"""
    if os.name != 'posix':
        return
    
    script_path = Path(__file__).parent.absolute()
    python_path = sys.executable
    
    service_content = f"""[Unit]
Description=Reddit AI Content Collector
After=network.target

[Service]
Type=simple
User={os.getenv('USER', 'nobody')}
WorkingDirectory={script_path}
Environment=PATH={os.environ.get('PATH')}
ExecStart={python_path} main.py scheduler start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
"""
    
    service_file = Path("reddit-ai-collector.service")
    with open(service_file, "w") as f:
        f.write(service_content)
    
    print(f"✅ 系统服务文件已创建: {service_file}")
    print("要安装系统服务，请运行:")
    print(f"  sudo cp {service_file} /etc/systemd/system/")
    print("  sudo systemctl enable reddit-ai-collector")
    print("  sudo systemctl start reddit-ai-collector")

def show_next_steps():
    """显示后续步骤"""
    print("\n" + "=" * 50)
    print("🎉 安装完成！后续步骤:")
    print()
    print("1. 配置API密钥:")
    print("   编辑 .env 文件，填入你的Reddit API和Cloudflare D1配置")
    print()
    print("2. 初始化数据库:")
    print("   在Cloudflare Dashboard中执行 cloudflare_d1_setup.sql")
    print()
    print("3. 测试系统:")
    print("   python main.py env              # 检查环境")
    print("   python main.py database test    # 测试数据库")
    print("   python main.py collect          # 手动执行一次采集")
    print()
    print("4. 启动调度器:")
    print("   python main.py scheduler start  # 前台启动")
    print("   python main.py scheduler daemon # 后台启动")
    print()
    print("5. 监控系统:")
    print("   python main.py monitor health   # 检查健康状态")
    print("   python main.py monitor report   # 生成详细报告")
    print()
    print("📖 详细文档: README.md")

def main():
    """主安装流程"""
    print("Reddit AI 内容采集系统 - 安装程序")
    print("=" * 50)
    
    steps = [
        ("检查Python版本", check_python_version),
        ("安装依赖包", install_dependencies),
        ("设置环境配置", setup_environment_file),
        ("下载NLTK数据", download_nltk_data),
        ("创建目录", create_directories),
    ]
    
    success_count = 0
    
    for step_name, step_func in steps:
        print(f"\n🔄 {step_name}...")
        try:
            if step_func():
                success_count += 1
            else:
                print(f"⚠️ {step_name} 未完全成功，但可以继续")
        except Exception as e:
            print(f"❌ {step_name} 失败: {e}")
    
    print(f"\n📊 安装进度: {success_count}/{len(steps)}")
    
    # 可选步骤
    print("\n🔧 可选配置...")
    
    # 测试配置 (可能失败，因为API密钥未配置)
    test_configuration()
    
    # 创建系统服务文件
    try:
        create_systemd_service()
    except Exception as e:
        print(f"⚠️ 创建系统服务文件失败: {e}")
    
    # 显示后续步骤
    show_next_steps()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
