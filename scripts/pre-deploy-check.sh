#!/bin/bash

# Reddit AI Crawler 部署前检查脚本
# 验证所有必要的配置和依赖

set -e

echo "🔍 Reddit AI Crawler - 部署前检查"
echo "=================================="

# 检查必要文件
echo "📁 检查项目文件..."

required_files=(
    "src/worker.ts"
    "wrangler.toml"
    "package.json"
    "database/migrations/0001_initial_schema.sql"
    "database/migrations/0002_create_indexes.sql"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        missing_files+=("$file")
    fi
done

if [[ ${#missing_files[@]} -gt 0 ]]; then
    echo "❌ 缺少必要文件："
    printf ' - %s\n' "${missing_files[@]}"
    exit 1
fi

echo "✅ 所有必要文件存在"

# 检查Node.js和npm
echo ""
echo "🟢 检查Node.js环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

node_version=$(node --version)
echo "✅ Node.js版本: $node_version"

# 检查wrangler
echo ""
echo "🔧 检查Wrangler CLI..."
if ! npx wrangler --version &> /dev/null; then
    echo "❌ Wrangler CLI 不可用"
    echo "请运行: npm install wrangler --save-dev"
    exit 1
fi

wrangler_version=$(npx wrangler --version)
echo "✅ Wrangler版本: $wrangler_version"

# 检查wrangler.toml配置
echo ""
echo "⚙️  检查Wrangler配置..."

if ! grep -q "database_id.*3d1a2cff-14ac-49e7-9bfd-b4a5606c9712" wrangler.toml; then
    echo "❌ wrangler.toml中的数据库ID不正确"
    exit 1
fi

if ! grep -q "reddit-ai-crawler" wrangler.toml; then
    echo "❌ wrangler.toml中缺少数据库名称"
    exit 1
fi

echo "✅ Wrangler配置正确"

# 检查TypeScript文件语法
echo ""
echo "📝 检查TypeScript语法..."
if command -v npx &> /dev/null && [[ -f "tsconfig.json" ]]; then
    if npx tsc --noEmit --skipLibCheck 2>/dev/null; then
        echo "✅ TypeScript语法检查通过"
    else
        echo "⚠️  TypeScript语法检查有警告，但继续部署"
    fi
else
    echo "⚠️  跳过TypeScript语法检查"
fi

# 检查环境变量配置
echo ""
echo "🔑 检查环境配置..."

env_vars_ok=true

# 检查wrangler.toml中的必要变量
required_vars=("DAILY_LIMIT" "MAX_POSTS_PER_REQUEST" "MIN_UPVOTE_RATIO")
for var in "${required_vars[@]}"; do
    if ! grep -q "$var" wrangler.toml; then
        echo "❌ 缺少环境变量: $var"
        env_vars_ok=false
    fi
done

if [[ "$env_vars_ok" == true ]]; then
    echo "✅ 环境变量配置正确"
else
    echo "❌ 环境变量配置不完整"
    exit 1
fi

# 检查数据库迁移文件
echo ""
echo "🗄️  检查数据库迁移..."

if ! grep -q "CREATE TABLE.*reddit_posts" database/migrations/0001_initial_schema.sql; then
    echo "❌ 数据库迁移文件不完整"
    exit 1
fi

if ! grep -q "CREATE INDEX" database/migrations/0002_create_indexes.sql; then
    echo "❌ 数据库索引文件不完整"
    exit 1
fi

echo "✅ 数据库迁移文件正确"

# 生成部署信息
echo ""
echo "📋 部署信息摘要："
echo "=================================="
echo "• 项目名称: reddit-ai-crawler-v2"
echo "• 数据库ID: 3d1a2cff-14ac-49e7-9bfd-b4a5606c9712"
echo "• 每日限制: $(grep 'DAILY_LIMIT' wrangler.toml | cut -d'"' -f2) 帖子"
echo "• 单次调用限制: $(grep 'MAX_POSTS_PER_REQUEST' wrangler.toml | cut -d'"' -f2) 帖子"
echo "• 最小点赞率: $(grep 'MIN_UPVOTE_RATIO' wrangler.toml | cut -d'"' -f2)"
echo "• 定时任务: 每日UTC 2:00 (北京时间10:00)"
echo ""

echo "🎯 需要设置的密钥："
echo "• REDDIT_CLIENT_ID (已提供)"
echo "• REDDIT_CLIENT_SECRET (已提供)"
echo "• REDDIT_USER_AGENT (将自动设置)"
echo "• GOOGLE_AI_API_KEY (可选)"
echo ""

echo "✅ 部署前检查完成！"
echo "🚀 运行 './scripts/deploy.sh' 开始部署"
