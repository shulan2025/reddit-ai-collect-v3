# Reddit AI Collect v3.0 🤖

> **Reddit AI帖子采集器 v3.0** - 修复URL字段问题，完善帖子链接处理，支持增量更新和智能去重

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/yourusername/reddit-ai-collect_v3)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/platform-Cloudflare%20Workers-orange.svg)](https://workers.cloudflare.com/)
[![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue.svg)](https://github.com/features/actions)

## 🚀 v3.0 新特性

- 🔗 **URL字段修复**: 修复帖子URL字段问题，新增post_url字段存储标准帖子链接
- ✨ **智能增量采集**: 自动过滤已采集数据，只获取新帖子
- 🔄 **直接API操作**: 使用Cloudflare API token直接操作D1数据库
- 📊 **实时统计**: 详细的采集统计和数据质量分析
- 🎯 **灵活配置**: 支持完整采集和增量采集两种模式
- 🛡️ **数据去重**: 智能去重机制，避免重复数据
- 📈 **性能优化**: 批量插入，API限流，错误重试
- 🐛 **Bug修复**: 修复测试脚本中的变量引用错误

## 📋 功能特性

### 🎯 核心功能
- **29个AI社区监控**: 覆盖主流AI相关Reddit社区
- **智能过滤**: 净赞数>10, 评论数>5, 点赞率>0.1
- **AI相关性检测**: 基于关键词的AI内容识别
- **时间窗口**: 只采集最近30天的帖子
- **数据完整性**: 包含标题、内容、链接、统计数据等核心字段

### 🔧 技术架构
- **Cloudflare Workers**: 无服务器执行环境
- **Cloudflare D1**: SQLite兼容的边缘数据库
- **GitHub Actions**: 自动化CI/CD和定时任务
- **Reddit API v2**: 官方API数据源
- **TypeScript**: 类型安全的开发语言

## 📊 数据字段

每条采集的帖子包含以下字段：

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | String | Reddit帖子唯一ID |
| `subreddit` | String | 社区名称 |
| `title` | String | 帖子标题 |
| `selftext` | String | 帖子正文内容 |
| `url` | String | 原始链接(图片/视频/外部链接) |
| `post_url` | String | 标准Reddit帖子链接 |
| `author` | String | 作者用户名 |
| `created_utc` | Integer | 发布时间戳 |
| `collected_at` | Integer | 采集时间戳 |
| `collection_date` | String | 采集日期 |
| `score` | Integer | 净赞数 |
| `num_comments` | Integer | 评论数 |
| `upvote_ratio` | Float | 点赞率 |
| `ai_relevance_score` | Float | AI相关性评分 |
| `is_ai_related` | Boolean | 是否AI相关 |

## 🎯 监控的AI社区

```
r/MachineLearning    r/artificial         r/deeplearning       r/LocalLLaMA
r/ChatGPT           r/OpenAI             r/computervision     r/NLP
r/MLPapers          r/StableDiffusion    r/ArtificialInteligence r/singularity
r/AI_Agents         r/agi                r/neuralnetworks     r/datasets
r/voiceai           r/MediaSynthesis     r/GPT3               r/grok
r/ClaudeAI          r/aivideo            r/IndianArtAI        r/gameai
r/GoogleGeminiAI    r/NovelAi            r/KindroidAI         r/WritingWithAI
r/Qwen_AI
```

## 🚀 快速开始

### 1. 环境要求
- Node.js 18+
- npm 或 yarn
- Cloudflare账户
- Reddit API密钥

### 2. 克隆项目
```bash
git clone https://github.com/yourusername/reddit-ai-collect_v2.git
cd reddit-ai-collect_v2
npm install
```

### 3. 配置环境变量
创建 `.dev.vars` 文件：
```bash
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=reddit-ai-collect_v2/2.0.0 (by /u/yourusername)
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
ACCOUNT_ID=your_account_id
DATABASE_ID=your_database_id
```

### 4. 数据库初始化
```bash
# 创建数据库表结构
npm run db:migrate

# 查看数据库状态
npm run db:stats
```

### 5. 本地测试
```bash
# 增量采集测试
npm run crawl:incremental

# 完整采集测试
npm run crawl:full
```

## 📋 使用指南

### 🔄 增量采集 (推荐)
增量采集会自动过滤今天已采集的数据，只获取新帖子：
```bash
npm run crawl:incremental
```

### 📥 完整采集
完整采集会重新获取所有符合条件的帖子：
```bash
npm run crawl:full
```

### 📊 数据库操作
```bash
# 查看统计信息
npm run db:stats

# 执行自定义查询
npm run db:query "SELECT COUNT(*) FROM redditV2_posts"

# 查看最新帖子
npm run db:query "SELECT title, subreddit, score FROM redditV2_posts ORDER BY created_utc DESC LIMIT 10"
```

## 🤖 GitHub Actions 自动化

### 每日自动采集
项目配置了GitHub Actions，每日北京时间10:00自动执行增量采集：

```yaml
# .github/workflows/daily-crawl-v2.yml
on:
  schedule:
    - cron: '0 2 * * *'  # UTC 02:00 = 北京时间 10:00
```

### 手动触发
在GitHub仓库的Actions页面可以手动触发采集：
- **增量采集**: 只采集新数据（默认）
- **完整采集**: 重新采集所有数据

### 配置Secrets
在GitHub仓库设置中添加以下Secrets：
```
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
CLOUDFLARE_API_TOKEN
ACCOUNT_ID
DATABASE_ID
```

## 📈 性能统计

### v2.0 实际测试结果
- **采集速度**: ~100帖子/分钟
- **数据质量**: 平均分数177，评论数43
- **去重效率**: 新增比例14%（智能过滤）
- **成功率**: 100%数据库插入成功率
- **覆盖范围**: 25个活跃AI社区

### 数据分布示例
```
时间分布:
  1天内: 317帖子 (29%)
  1-7天: 453帖子 (41%)
  7-14天: 181帖子 (16%)
  14-30天: 147帖子 (13%)

社区贡献 Top 5:
  r/ChatGPT: 66帖子
  r/LocalLLaMA: 69帖子
  r/OpenAI: 69帖子
  r/artificial: 69帖子
  r/MachineLearning: 69帖子
```

## 🛠️ 开发指南

### 项目结构
```
reddit-ai-collect_v2/
├── src/                          # 源代码
│   ├── modules/                  # 功能模块
│   │   ├── collector/           # 数据采集
│   │   ├── processor/           # 数据处理
│   │   ├── storage/             # 数据存储
│   │   └── scheduler/           # 任务调度
│   ├── types/                   # TypeScript类型定义
│   ├── utils/                   # 工具函数
│   └── worker.ts               # Cloudflare Worker入口
├── scripts/                     # 执行脚本
│   ├── full-crawl-2000.js      # 完整采集脚本
│   ├── incremental-crawl.js    # 增量采集脚本
│   └── direct-d1-insert.js     # 直接数据库插入
├── database/                    # 数据库相关
│   └── migrations/             # 数据库迁移文件
├── .github/workflows/          # GitHub Actions配置
└── data/                       # 采集数据存储
```

### 核心模块

#### 数据采集 (Collector)
- `auth-manager.ts`: Reddit API认证
- `rate-limiter.ts`: API限流控制
- `reddit-client.ts`: Reddit API客户端

#### 数据处理 (Processor)
- `simple-filter.ts`: 基础数据过滤
- `ai-detector.ts`: AI相关性检测
- `post-processor.ts`: 帖子处理orchestrator

#### 数据存储 (Storage)
- `simple-database-manager.ts`: D1数据库管理
- `models/`: 数据模型定义

### 扩展开发
1. **添加新的过滤规则**: 修改 `simple-filter.ts`
2. **优化AI检测**: 更新 `ai-detector.ts` 中的关键词
3. **新增数据字段**: 更新数据库schema和模型
4. **自定义通知**: 扩展GitHub Actions通知逻辑

## 🔧 配置说明

### 关键配置参数
```javascript
// 采集配置
DAILY_LIMIT = 2000              // 每日采集上限
MAX_POSTS_PER_REQUEST = 80      // 单次API请求最大帖子数
MIN_UPVOTE_RATIO = 0.1         // 最小点赞率
API_REQUEST_INTERVAL = 1000     // API请求间隔(ms)
MAX_RETRIES = 3                // 最大重试次数

// 过滤条件
MIN_SCORE = 10                 // 最小净赞数
MIN_COMMENTS = 5               // 最小评论数
TIME_WINDOW_DAYS = 30          // 时间窗口(天)
```

### 数据库配置
```toml
# wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "reddit-ai-crawler"
database_id = "your_database_id"
```

## 🚀 部署指南

### 1. Cloudflare Workers部署
```bash
# 登录Cloudflare
npx wrangler login

# 部署Worker
npm run deploy

# 设置环境变量
npx wrangler secret put REDDIT_CLIENT_ID
npx wrangler secret put REDDIT_CLIENT_SECRET
npx wrangler secret put GOOGLE_AI_API_KEY
```

### 2. 数据库迁移
```bash
# 远程数据库迁移
npm run db:migrate

# 验证表结构
npm run db:query "SELECT name FROM sqlite_master WHERE type='table'"
```

### 3. 测试部署
```bash
# 健康检查
npm run health

# 触发采集测试
npm run crawl:trigger
```

## 📊 监控和维护

### 日志监控
```bash
# 实时日志
npm run tail

# 查看Worker状态
npm run status
```

### 数据质量检查
```bash
# 每日统计
npm run db:stats

# 数据分布检查
npm run db:query "SELECT collection_date, COUNT(*) FROM redditV2_posts GROUP BY collection_date ORDER BY collection_date DESC LIMIT 7"

# 社区分布检查
npm run db:query "SELECT subreddit, COUNT(*) as count FROM redditV2_posts GROUP BY subreddit ORDER BY count DESC"
```

### 故障排除
1. **API认证失败**: 检查Reddit API密钥是否有效
2. **数据库连接失败**: 验证Cloudflare API token权限
3. **采集数据为空**: 检查过滤条件是否过于严格
4. **重复数据**: 确认增量采集的去重逻辑

## 📈 版本历史

### v2.0.0 (2025-09-24)
- ✨ 新增智能增量采集功能
- 🔄 直接API操作，无需wrangler OAuth
- 📊 详细的采集统计和质量分析
- 🎯 支持完整采集和增量采集模式
- 🛡️ 智能去重机制
- 📈 性能优化和错误处理

### v1.0.0
- 🚀 基础Reddit数据采集功能
- 📋 29个AI社区监控
- 🔍 基础过滤和AI检测
- 💾 Cloudflare D1数据存储

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

- 🐛 **Bug报告**: [GitHub Issues](https://github.com/yourusername/reddit-ai-collect_v2/issues)
- 💡 **功能请求**: [GitHub Discussions](https://github.com/yourusername/reddit-ai-collect_v2/discussions)
- 📧 **邮件支持**: your.email@example.com

## 🙏 致谢

- [Reddit API](https://www.reddit.com/dev/api/) - 数据源
- [Cloudflare Workers](https://workers.cloudflare.com/) - 执行平台
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - 数据存储
- [GitHub Actions](https://github.com/features/actions) - CI/CD平台

---

<div align="center">
  <p>⭐ 如果这个项目对您有帮助，请给个Star支持一下！</p>
  <p>Made with ❤️ for the AI Community</p>
</div>