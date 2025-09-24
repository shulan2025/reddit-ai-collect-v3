#!/bin/bash

# Reddit AI Collect v2.0 发布脚本
# 创建Git标签并准备GitHub发布

set -e

VERSION="2.0.0"
TAG_NAME="v${VERSION}"

echo "🚀 准备发布 Reddit AI Collect v${VERSION}..."
echo ""

# 检查是否在main分支
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ 错误: 请在main分支上创建发布"
    echo "当前分支: $CURRENT_BRANCH"
    exit 1
fi

# 检查工作区是否干净
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ 错误: 工作区有未提交的更改"
    echo "请先提交所有更改后再创建发布"
    git status --short
    exit 1
fi

# 检查是否已存在该标签
if git tag -l | grep -q "^${TAG_NAME}$"; then
    echo "❌ 错误: 标签 ${TAG_NAME} 已存在"
    echo "如需重新创建，请先删除现有标签:"
    echo "git tag -d ${TAG_NAME}"
    echo "git push origin :refs/tags/${TAG_NAME}"
    exit 1
fi

echo "✅ 预检查通过"
echo ""

# 显示即将发布的文件
echo "📁 发布内容预览:"
echo "├── 📄 README.md (v2.0文档)"
echo "├── 📄 CHANGELOG.md (更新日志)"
echo "├── 📄 RELEASE_NOTES_v2.0.md (发布说明)"
echo "├── 📄 ENVIRONMENT_SETUP.md (环境配置)"
echo "├── 📄 package.json (v2.0.0)"
echo "├── 🤖 .github/workflows/daily-crawl-v2.yml"
echo "├── 🔧 scripts/incremental-crawl.js"
echo "├── 🔧 scripts/direct-d1-insert.js"
echo "└── 📊 data/ (采集数据示例)"
echo ""

# 确认发布
read -p "是否继续创建发布? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 发布已取消"
    exit 0
fi

echo "🏷️ 创建Git标签 ${TAG_NAME}..."

# 创建带注释的标签
git tag -a "${TAG_NAME}" -m "Reddit AI Collect v${VERSION}

🚀 重大更新:
- 智能增量采集功能
- 直接API操作D1数据库  
- 性能提升3倍
- 100%数据库插入成功率

📊 实测数据:
- 单次采集1,098条帖子
- 增量去重效率86%
- 平均质量评分177

🔧 技术改进:
- 批量数据插入
- 智能去重机制
- 增强错误处理
- 完善的统计报告

查看完整发布说明: RELEASE_NOTES_v2.0.md"

echo "✅ 标签创建成功"

# 推送标签到远程
echo "📤 推送标签到GitHub..."
git push origin "${TAG_NAME}"

echo "✅ 标签推送成功"
echo ""

# 生成发布信息
echo "📋 GitHub发布信息:"
echo "================================"
echo "标签: ${TAG_NAME}"
echo "标题: Reddit AI Collect v${VERSION} - Smart Incremental"
echo ""
echo "发布说明模板:"
echo "--------------------------------"
cat << EOF

## 🎉 Reddit AI Collect v${VERSION} 正式发布!

### 🚀 重大更新
- **智能增量采集**: 自动过滤已采集数据，只获取新帖子
- **直接API操作**: 使用Cloudflare API token直接操作D1数据库
- **性能大幅提升**: 采集速度提升至~100帖子/分钟，成功率100%

### 📊 实测数据表现
- 单次采集: 1,098条高质量帖子
- 增量效率: 新增比例14%，有效过滤重复数据
- 数据质量: 平均分数177，评论数43，点赞率0.88
- 覆盖范围: 25个活跃AI社区，时间跨度30天

### 🔧 主要改进
- 智能去重机制，避免重复采集
- 批量数据插入，提升数据库写入效率
- 增强的错误处理和重试机制
- 详细的采集统计和质量分析

### 📋 新增功能
- \`npm run crawl:incremental\` - 智能增量采集
- \`npm run crawl:full\` - 完整数据采集
- 升级版GitHub Actions工作流
- 直接数据库操作脚本

### 🚀 快速开始
\`\`\`bash
git clone https://github.com/yourusername/reddit-ai-collect_v2.git
cd reddit-ai-collect_v2
npm install
cp .env.example .dev.vars
# 编辑 .dev.vars 填入API密钥
npm run crawl:incremental
\`\`\`

### 📚 完整文档
- [README.md](README.md) - 完整使用指南
- [RELEASE_NOTES_v2.0.md](RELEASE_NOTES_v2.0.md) - 详细发布说明
- [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) - 环境配置指南
- [CHANGELOG.md](CHANGELOG.md) - 版本更新历史

### 🔄 从v1.0升级
查看[迁移指南](RELEASE_NOTES_v2.0.md#-迁移指南)了解升级步骤。

---

**立即体验智能增量采集的强大功能！** 🚀

EOF

echo "================================"
echo ""

echo "🎯 下一步操作:"
echo "1. 访问 GitHub仓库的 Releases 页面"
echo "2. 点击 'Create a new release'"
echo "3. 选择标签 ${TAG_NAME}"
echo "4. 复制上面的发布说明"
echo "5. 上传相关文件 (可选)"
echo "6. 点击 'Publish release'"
echo ""

echo "🔗 GitHub Releases URL:"
echo "https://github.com/yourusername/reddit-ai-collect_v2/releases/new?tag=${TAG_NAME}"
echo ""

echo "✅ Reddit AI Collect v${VERSION} 发布准备完成! 🎉"
