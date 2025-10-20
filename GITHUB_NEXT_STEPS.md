# 🎉 GitHub仓库创建成功！下一步操作指南

## ✅ 已完成
- ✅ GitHub仓库已创建: `https://github.com/shulan2025/reddit-ai-collect-v3`
- ✅ Reddit AI Collect v3.0核心代码已推送
- ✅ 包含50个文件：脚本、文档、配置等

## 🚀 接下来需要完成的步骤

### 第1步：添加GitHub Actions工作流 (2分钟)

由于权限限制，需要通过GitHub网页界面添加工作流文件：

#### 1.1 添加部署工作流
1. 在GitHub仓库页面，点击 **"Create new file"**
2. 文件名输入: `.github/workflows/deploy.yml`
3. 复制以下内容：

```yaml
name: Deploy Reddit AI Collect v3.0

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --minify --env production

      - name: Run database migrations
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: d1 execute reddit-ai-crawler --file=database/migrations/0001_initial_schema.sql --remote

      - name: Run database index migrations
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: d1 execute reddit-ai-crawler --file=database/migrations/0002_create_indexes.sql --remote

      - name: Set Secrets
        run: |
          echo "✅ 部署完成，请手动配置以下Secrets:"
          echo "  - REDDIT_CLIENT_ID"
          echo "  - REDDIT_CLIENT_SECRET" 
          echo "  - REDDIT_USER_AGENT"
          echo "  - GOOGLE_AI_API_KEY"
```

4. 点击 **"Commit new file"**

#### 1.2 添加每日采集工作流
1. 再次点击 **"Create new file"**
2. 文件名输入: `.github/workflows/daily-crawl.yml`
3. 复制以下内容：

```yaml
name: Daily Reddit AI Collect v3.0

on:
  schedule:
    - cron: '0 2 * * *'  # 每天UTC 2:00 (北京时间10:00)
  workflow_dispatch:
    inputs:
      target_count:
        description: '采集目标数量'
        required: false
        default: '500'

jobs:
  incremental-crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run incremental crawl
        run: node scripts/incremental-crawl.js
        env:
          REDDIT_CLIENT_ID: ${{ secrets.REDDIT_CLIENT_ID }}
          REDDIT_CLIENT_SECRET: ${{ secrets.REDDIT_CLIENT_SECRET }}
          REDDIT_USER_AGENT: ${{ secrets.REDDIT_USER_AGENT }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_D1_DATABASE_ID: ${{ secrets.CLOUDFLARE_D1_DATABASE_ID }}
          GOOGLE_AI_API_KEY: ${{ secrets.GOOGLE_AI_API_KEY }}
          DAILY_LIMIT: ${{ github.event.inputs.target_count || '500' }}

      - name: Report results
        run: echo "✅ 增量采集完成"
```

4. 点击 **"Commit new file"**

### 第2步：配置GitHub Secrets (3分钟)

1. 在GitHub仓库页面，点击 **Settings**
2. 左侧菜单选择 **Secrets and variables** → **Actions**
3. 点击 **New repository secret**，逐一添加以下7个Secrets：

| Secret名称 | 值 |
|------------|-----|
| `REDDIT_CLIENT_ID` | `NJnkQLyA6Gie7rGvCI3zYg` |
| `REDDIT_CLIENT_SECRET` | `WHFMSNNZBt1gV5xC394LGhrr5LzyPQ` |
| `REDDIT_USER_AGENT` | `reddit-ai-collect_v3/3.0.0 (by /u/ai_researcher)` |
| `CLOUDFLARE_API_TOKEN` | `WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU` |
| `CLOUDFLARE_ACCOUNT_ID` | `e23dc8a212c55fe9210b99f24be11eb9` |
| `CLOUDFLARE_D1_DATABASE_ID` | `3d1a2cff-14ac-49e7-9bfd-b4a5606c9712` |
| `GOOGLE_AI_API_KEY` | `AIzaSyBqiSrxMcYrYtqjCVYTMnO7YkLxBcBWRrQ` |

### 第3步：启用GitHub Actions (1分钟)

1. 点击 **Actions** 选项卡
2. 如果提示启用Actions，点击 **"I understand my workflows, go ahead and enable them"**
3. 您将看到两个工作流：
   - "Deploy Reddit AI Collect v3.0"
   - "Daily Reddit AI Collect v3.0"

### 第4步：首次部署测试 (2分钟)

1. 在Actions页面，选择 **"Deploy Reddit AI Collect v3.0"**
2. 点击 **"Run workflow"** → **"Run workflow"**
3. 等待部署完成（约2-3分钟）
4. 绿色✅表示成功，红色❌表示失败

### 第5步：验证部署 (1分钟)

部署成功后，测试以下URL：
```bash
# 健康检查
https://reddit-ai-crawler-v2.xiaoyan-chen222.workers.dev/health

# 查看统计
https://reddit-ai-crawler-v2.xiaoyan-chen222.workers.dev/stats
```

## 🎯 完成后的效果

✅ **每日自动运行**: 每天北京时间10:00自动采集AI帖子  
✅ **智能增量采集**: 只获取新帖子，避免重复  
✅ **高质量数据**: 平均分数>50，评论>5，点赞率>0.1  
✅ **完整URL支持**: v3.0修复了URL字段问题  

## 🔧 常用操作

### 手动触发采集
1. Actions → "Daily Reddit AI Collect v3.0"
2. "Run workflow" → 输入目标数量 → "Run workflow"

### 查看运行日志
1. Actions页面查看每次运行的详细日志
2. 绿色✅成功，红色❌失败

### 调整采集时间
编辑 `.github/workflows/daily-crawl.yml` 中的 cron 表达式

## ❓ 需要帮助？

如果在设置过程中遇到问题：
1. 检查Secrets是否正确配置
2. 查看Actions运行日志中的错误信息
3. 确保所有API密钥都有效

---

**🎉 完成以上步骤后，Reddit AI Collect v3.0将完全自动化运行！**
