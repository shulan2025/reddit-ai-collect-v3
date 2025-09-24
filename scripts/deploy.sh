#!/bin/bash

# Reddit AI Crawler 部署脚本
# 自动化设置Cloudflare Workers环境

set -e

echo "🚀 开始部署 Reddit AI Crawler"
echo "================================="

# 检查必要的工具
echo "📋 检查环境..."
if ! command -v npx &> /dev/null; then
    echo "❌ npx 未安装，请先安装 Node.js"
    exit 1
fi

# 检查wrangler是否可用
if ! npx wrangler --version &> /dev/null; then
    echo "❌ wrangler 不可用，请检查安装"
    exit 1
fi

echo "✅ 环境检查通过"

# 构建项目
echo ""
echo "🔨 构建项目..."
npm run build

# 设置Cloudflare认证（如果需要）
echo ""
echo "🔑 配置Cloudflare认证..."
echo "请确保您已经通过以下方式之一进行了认证："
echo "1. wrangler login"
echo "2. 设置 CLOUDFLARE_API_TOKEN 环境变量"
echo ""

# 应用数据库迁移
echo "📊 应用数据库迁移..."
echo "正在创建数据库表结构..."

npx wrangler d1 execute reddit-ai-crawler --file=database/migrations/0001_initial_schema.sql --remote || {
    echo "⚠️  数据库迁移可能已经执行过，继续部署..."
}

npx wrangler d1 execute reddit-ai-crawler --file=database/migrations/0002_create_indexes.sql --remote || {
    echo "⚠️  索引创建可能已经执行过，继续部署..."
}

# 设置密钥
echo ""
echo "🔐 设置API密钥..."
echo "正在设置Reddit API密钥..."

# Reddit API 密钥
echo "设置 REDDIT_CLIENT_ID..."
echo "NJnkQLyA6Gie7rGvCI3zYg" | npx wrangler secret put REDDIT_CLIENT_ID

echo "设置 REDDIT_CLIENT_SECRET..."
echo "WHFMSNNZBt1gV5xC394LGhrr5LzyPQ" | npx wrangler secret put REDDIT_CLIENT_SECRET

echo "设置 REDDIT_USER_AGENT..."
echo "reddit-ai-crawler/1.0.0 (by /u/ai_researcher)" | npx wrangler secret put REDDIT_USER_AGENT

# Google AI API密钥（可选）
read -p "是否要设置Google AI API密钥？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "请输入Google AI API密钥: " -s google_api_key
    echo
    echo "$google_api_key" | npx wrangler secret put GOOGLE_AI_API_KEY
    echo "✅ Google AI API密钥已设置"
else
    echo "⏭️  跳过Google AI API密钥设置"
fi

# 部署到Cloudflare Workers
echo ""
echo "🌐 部署到Cloudflare Workers..."
npx wrangler deploy

echo ""
echo "✅ 部署完成！"
echo "================================="
echo ""
echo "📋 部署信息："
echo "• Worker名称: reddit-ai-crawler-v2"
echo "• 数据库: reddit-ai-crawler"
echo "• 定时任务: 每日UTC 2:00 (北京时间10:00)"
echo "• 每日限制: 2000条帖子"
echo ""
echo "🌍 访问地址："
echo "• 主页: https://reddit-ai-crawler-v2.your-subdomain.workers.dev/"
echo "• 健康检查: https://reddit-ai-crawler-v2.your-subdomain.workers.dev/health"
echo "• 手动触发: POST https://reddit-ai-crawler-v2.your-subdomain.workers.dev/crawl"
echo ""
echo "📊 监控命令："
echo "• 查看日志: npx wrangler tail"
echo "• 检查数据库: npx wrangler d1 execute reddit-ai-crawler --command \"SELECT COUNT(*) FROM reddit_posts\""
echo ""
echo "🎉 Reddit AI Crawler 部署成功！"
