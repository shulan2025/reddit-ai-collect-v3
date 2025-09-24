# 部署检查清单

## 📋 部署前准备

### 1. 环境准备
- [ ] 安装 Node.js 18+
- [ ] 安装 npm 或 yarn
- [ ] 安装 Wrangler CLI (`npm install -g wrangler`)
- [ ] Cloudflare 账号注册和登录

### 2. 项目配置
- [ ] 克隆项目代码
- [ ] 安装项目依赖 (`npm install`)
- [ ] 复制 `env.example` 为 `.env` 并填写配置

### 3. Cloudflare 配置
- [ ] 登录 Cloudflare (`wrangler login`)
- [ ] 创建 D1 数据库 (`wrangler d1 create reddit-ai-crawler`)
- [ ] 更新 `wrangler.toml` 中的数据库ID
- [ ] 设置 API 密钥 (通过 `wrangler secret put`)

### 4. Reddit API 配置
- [ ] 注册 Reddit 应用 (https://www.reddit.com/prefs/apps)
- [ ] 获取 Client ID 和 Client Secret
- [ ] 设置合适的 User-Agent
- [ ] 测试 API 连接

## 🚀 部署步骤

### 1. 数据库初始化
```bash
# 运行本地迁移
wrangler d1 migrations apply reddit-ai-crawler --local

# 运行生产环境迁移
wrangler d1 migrations apply reddit-ai-crawler
```

### 2. 设置环境变量
```bash
# Reddit API 配置
wrangler secret put REDDIT_CLIENT_ID
wrangler secret put REDDIT_CLIENT_SECRET
wrangler secret put REDDIT_USER_AGENT

# Google AI API (可选)
wrangler secret put GOOGLE_AI_API_KEY
```

### 3. 构建和部署
```bash
# 构建项目
npm run build

# 部署到 Cloudflare Workers
npm run deploy
```

### 4. 验证部署
- [ ] 访问 Worker URL 检查基本响应
- [ ] 测试 `/health` 端点
- [ ] 测试 `/stats` 端点
- [ ] 手动触发 `/crawl` 端点测试

## 🔧 GitHub Actions 配置

### 1. 设置 GitHub Secrets
在 GitHub 仓库的 Settings > Secrets and variables > Actions 中添加：

- [ ] `CLOUDFLARE_API_TOKEN` - Cloudflare API Token
- [ ] `CLOUDFLARE_ACCOUNT_ID` - Cloudflare Account ID
- [ ] `REDDIT_CLIENT_ID` - Reddit Client ID
- [ ] `REDDIT_CLIENT_SECRET` - Reddit Client Secret
- [ ] `REDDIT_USER_AGENT` - Reddit User Agent
- [ ] `GOOGLE_AI_API_KEY` - Google AI API Key (可选)
- [ ] `CRAWLER_WEBHOOK_URL` - Worker URL

### 2. 验证 Actions
- [ ] 推送代码触发部署 Action
- [ ] 检查 Action 执行日志
- [ ] 验证自动部署成功

## 📊 监控配置

### 1. 日志监控
```bash
# 查看实时日志
wrangler tail
```

### 2. 数据库监控
```bash
# 检查数据库状态
wrangler d1 execute reddit-ai-crawler --command "SELECT COUNT(*) FROM reddit_posts"

# 查看今日统计
wrangler d1 execute reddit-ai-crawler --command "SELECT * FROM daily_summary ORDER BY date DESC LIMIT 5"
```

### 3. 性能监控
- [ ] 设置 Cloudflare Analytics
- [ ] 配置错误告警
- [ ] 监控 API 调用频率

## ✅ 部署后验证

### 1. 功能测试
- [ ] 手动触发爬取任务
- [ ] 验证数据正确存储
- [ ] 检查过滤规则生效
- [ ] 测试错误处理机制

### 2. 性能测试
- [ ] 检查响应时间
- [ ] 验证内存使用
- [ ] 测试并发处理能力

### 3. 定时任务测试
- [ ] 验证 Cron 触发器配置
- [ ] 测试定时任务执行
- [ ] 检查任务执行日志

## 🚨 故障排除

### 常见问题及解决方案

#### 1. 数据库连接失败
```bash
# 检查数据库配置
wrangler d1 list

# 测试数据库连接
wrangler d1 execute reddit-ai-crawler --command "SELECT 1"
```

#### 2. Reddit API 认证失败
- 检查 Client ID 和 Secret 是否正确
- 验证 User-Agent 格式
- 确认 API 密钥已正确设置

#### 3. Worker 部署失败
- 检查 `wrangler.toml` 配置
- 验证 TypeScript 编译
- 查看部署错误日志

#### 4. 定时任务未执行
- 检查 Cron 表达式语法
- 验证触发器配置
- 查看 GitHub Actions 日志

## 📈 优化建议

### 1. 性能优化
- [ ] 启用 Cloudflare 缓存
- [ ] 优化数据库查询
- [ ] 减少 API 调用频率

### 2. 安全优化
- [ ] 定期轮换 API 密钥
- [ ] 设置访问限制
- [ ] 启用日志审计

### 3. 成本优化
- [ ] 监控 Worker 执行时间
- [ ] 优化数据库存储
- [ ] 合理设置采集频率

## 📞 支持联系

如果在部署过程中遇到问题：

1. 查看项目 [Issues](https://github.com/your-username/reddit-ai-crawler-v2/issues)
2. 参考 [README.md](../README.md) 文档
3. 检查 Cloudflare Workers 文档
4. 联系项目维护者

---

✅ 完成所有检查项后，你的 Reddit AI Crawler v2.0 就可以正常运行了！
