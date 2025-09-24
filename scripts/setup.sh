#!/bin/bash

# Reddit AI Crawler v2.0 设置脚本
# 用于初始化项目环境和配置

set -e

echo "🚀 开始设置 Reddit AI Crawler v2.0..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查必要的工具
check_dependencies() {
    echo -e "${BLUE}检查依赖工具...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js 未安装，请先安装 Node.js 18+${NC}"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm 未安装${NC}"
        exit 1
    fi
    
    if ! command -v wrangler &> /dev/null; then
        echo -e "${YELLOW}⚠️  Wrangler CLI 未安装，正在安装...${NC}"
        npm install -g wrangler
    fi
    
    echo -e "${GREEN}✅ 依赖检查完成${NC}"
}

# 安装项目依赖
install_dependencies() {
    echo -e "${BLUE}安装项目依赖...${NC}"
    npm install
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
}

# Cloudflare 登录
cloudflare_login() {
    echo -e "${BLUE}Cloudflare 登录...${NC}"
    echo -e "${YELLOW}请在浏览器中完成 Cloudflare 登录${NC}"
    wrangler login
    echo -e "${GREEN}✅ Cloudflare 登录完成${NC}"
}

# 创建 D1 数据库
create_database() {
    echo -e "${BLUE}创建 D1 数据库...${NC}"
    
    # 检查数据库是否已存在
    if wrangler d1 list | grep -q "reddit-ai-crawler"; then
        echo -e "${YELLOW}⚠️  数据库已存在，跳过创建${NC}"
    else
        wrangler d1 create reddit-ai-crawler
        echo -e "${GREEN}✅ D1 数据库创建完成${NC}"
        echo -e "${YELLOW}⚠️  请将数据库ID更新到 wrangler.toml 文件中${NC}"
    fi
}

# 运行数据库迁移
run_migrations() {
    echo -e "${BLUE}运行数据库迁移...${NC}"
    
    # 本地迁移
    echo -e "${YELLOW}运行本地迁移...${NC}"
    wrangler d1 migrations apply reddit-ai-crawler --local
    
    # 生产环境迁移
    read -p "是否运行生产环境迁移? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        wrangler d1 migrations apply reddit-ai-crawler
        echo -e "${GREEN}✅ 生产环境迁移完成${NC}"
    else
        echo -e "${YELLOW}⚠️  跳过生产环境迁移${NC}"
    fi
}

# 设置环境变量
setup_secrets() {
    echo -e "${BLUE}设置环境变量...${NC}"
    
    echo -e "${YELLOW}请输入以下API密钥信息:${NC}"
    
    read -p "Reddit Client ID: " REDDIT_CLIENT_ID
    read -p "Reddit Client Secret: " REDDIT_CLIENT_SECRET
    read -p "Reddit User Agent (例: reddit-ai-crawler/1.0.0 (by /u/your_username)): " REDDIT_USER_AGENT
    read -p "Google AI API Key (可选): " GOOGLE_AI_API_KEY
    
    # 设置密钥
    echo "$REDDIT_CLIENT_ID" | wrangler secret put REDDIT_CLIENT_ID
    echo "$REDDIT_CLIENT_SECRET" | wrangler secret put REDDIT_CLIENT_SECRET
    echo "$REDDIT_USER_AGENT" | wrangler secret put REDDIT_USER_AGENT
    
    if [ ! -z "$GOOGLE_AI_API_KEY" ]; then
        echo "$GOOGLE_AI_API_KEY" | wrangler secret put GOOGLE_AI_API_KEY
    fi
    
    echo -e "${GREEN}✅ 环境变量设置完成${NC}"
}

# 初始化社区配置
init_subreddit_configs() {
    echo -e "${BLUE}初始化社区配置...${NC}"
    
    # 这里可以添加初始化社区配置到数据库的逻辑
    # 暂时跳过，配置在JSON文件中
    
    echo -e "${GREEN}✅ 社区配置初始化完成${NC}"
}

# 测试部署
test_deployment() {
    echo -e "${BLUE}测试部署...${NC}"
    
    # 构建项目
    npm run build
    
    # 部署到 Cloudflare Workers
    wrangler deploy
    
    echo -e "${GREEN}✅ 部署完成${NC}"
    
    # 获取 Worker URL
    WORKER_URL=$(wrangler whoami 2>/dev/null | grep "subdomain" | cut -d'"' -f4)
    if [ ! -z "$WORKER_URL" ]; then
        echo -e "${GREEN}🌐 Worker URL: https://reddit-ai-crawler-v2.${WORKER_URL}.workers.dev${NC}"
    fi
}

# 主函数
main() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                Reddit AI Crawler v2.0 设置                  ║"
    echo "║                                                              ║"
    echo "║  这个脚本将帮助你完成项目的初始化设置                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # 执行设置步骤
    check_dependencies
    install_dependencies
    cloudflare_login
    create_database
    run_migrations
    setup_secrets
    init_subreddit_configs
    test_deployment
    
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                     🎉 设置完成！                           ║"
    echo "║                                                              ║"
    echo "║  接下来你可以:                                               ║"
    echo "║  1. 运行 npm run dev 启动开发服务器                          ║"
    echo "║  2. 访问 /health 端点检查系统状态                            ║"
    echo "║  3. 使用 POST /crawl 手动触发爬取任务                        ║"
    echo "║  4. 查看 README.md 了解更多使用方法                          ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 运行主函数
main "$@"
