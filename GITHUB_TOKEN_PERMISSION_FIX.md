# 🔐 GitHub Token权限问题解决指南

## 🎯 问题描述
当前GitHub Personal Access Token缺少`workflow`权限，导致无法推送`.github/workflows/`文件到仓库。

## 🚀 解决方案

### 方案1: 更新现有Token权限 (推荐)

#### 步骤1: 访问GitHub Token设置
1. 打开浏览器，访问: https://github.com/settings/tokens
2. 找到当前使用的Personal Access Token
3. 点击Token右侧的 **"Edit"** 按钮

#### 步骤2: 添加workflow权限
在权限列表中找到并勾选:
- ✅ `workflow` - Update GitHub Action workflows

#### 步骤3: 保存更改
1. 滚动到页面底部
2. 点击 **"Update token"** 按钮
3. 确认更新成功

#### 步骤4: 验证修复
返回项目目录，重新推送:
```bash
git push origin main
```

---

### 方案2: 创建新的Token (备选)

如果无法编辑现有Token，可以创建新的:

#### 步骤1: 创建新Token
1. 访问: https://github.com/settings/tokens
2. 点击 **"Generate new token"** → **"Generate new token (classic)"**
3. 设置Token名称: `reddit-ai-collect-v3-workflow`

#### 步骤2: 选择权限
必需权限:
- ✅ `repo` - Full control of private repositories
- ✅ `workflow` - Update GitHub Action workflows
- ✅ `write:packages` - Write packages to GitHub Package Registry
- ✅ `delete:packages` - Delete packages from GitHub Package Registry

#### 步骤3: 生成并保存
1. 设置过期时间 (建议90天)
2. 点击 **"Generate token"**
3. **重要**: 立即复制Token，只显示一次！

#### 步骤4: 更新Git配置
```bash
# 更新远程仓库URL使用新Token
git remote set-url origin https://NEW_TOKEN@github.com/shulan2025/reddit-ai-collect-v3.git
```

---

### 方案3: 手动创建工作流 (临时方案)

如果Token问题暂时无法解决，可以通过网页界面创建:

#### 步骤1: 访问仓库
打开: https://github.com/shulan2025/reddit-ai-collect-v3

#### 步骤2: 创建工作流
1. 点击 **Actions** 选项卡
2. 点击 **"New workflow"**
3. 选择 **"set up a workflow yourself"**

#### 步骤3: 创建每日采集工作流
文件名: `.github/workflows/daily-crawl-v3.yml`

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
        default: '1000'

jobs:
  incremental-crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run incremental crawl
        run: node scripts/incremental-crawl.js
        env:
          REDDIT_CLIENT_ID: ${{ secrets.REDDIT_CLIENT_ID }}
          REDDIT_CLIENT_SECRET: ${{ secrets.REDDIT_CLIENT_SECRET }}
          REDDIT_USER_AGENT: 'reddit-ai-collect_v3/3.0.0'
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          ACCOUNT_ID: ${{ secrets.ACCOUNT_ID }}
          DATABASE_ID: ${{ secrets.DATABASE_ID }}
```

#### 步骤4: 配置Secrets
在 **Settings** → **Secrets and variables** → **Actions** 中添加:
- `REDDIT_CLIENT_ID`: `NJnkQLyA6Gie7rGvCI3zYg`
- `REDDIT_CLIENT_SECRET`: `WHFMSNNZBt1gV5xC394LGhrr5LzyPQ`
- `CLOUDFLARE_API_TOKEN`: `WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU`
- `ACCOUNT_ID`: `e23dc8a212c55fe9210b99f24be11eb9`
- `DATABASE_ID`: `3d1a2cff-14ac-49e7-9bfd-b4a5606c9712`

---

## 🎯 推荐行动顺序

1. **首选**: 方案1 - 更新现有Token权限 (最简单)
2. **备选**: 方案2 - 创建新Token (如果无法编辑现有Token)
3. **临时**: 方案3 - 手动创建工作流 (应急方案)

## ✅ 验证成功标志

权限修复成功后，您应该能够:
- ✅ 成功推送包含工作流文件的提交
- ✅ 在GitHub Actions中看到工作流
- ✅ 手动触发工作流测试
- ✅ 每日自动采集正常运行

---

**选择哪个方案？请告诉我您的偏好，我将协助您完成具体操作。**
