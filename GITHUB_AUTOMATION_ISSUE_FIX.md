# 🔧 GitHub Actions自动化问题解决方案

## 🎯 问题诊断结果

✅ **手动采集测试**: 成功采集733条新帖子到数据库  
❌ **GitHub Actions**: 工作流文件推送被拒绝，权限不足  

### 问题根源
GitHub Personal Access Token缺少`workflow`权限，无法创建或更新`.github/workflows/`文件。

---

## 🚀 解决方案

### 方法1: 更新GitHub Token权限 (推荐)

1. **访问GitHub Settings**:
   - 打开: https://github.com/settings/tokens
   - 找到当前使用的Personal Access Token

2. **更新Token权限**:
   - 点击Token右侧的"Edit"
   - 在权限列表中勾选 ✅ `workflow`
   - 点击"Update token"

3. **重新推送工作流**:
   ```bash
   git push origin main
   ```

### 方法2: 通过GitHub网页界面创建工作流

如果无法更新Token权限，可以通过网页界面手动创建：

#### 2.1 创建每日采集工作流
1. 在GitHub仓库页面，点击 **Actions** → **New workflow** → **set up a workflow yourself**
2. 文件名: `.github/workflows/daily-crawl.yml`
3. 复制以下内容:

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

      - name: Report results
        run: echo "✅ 增量采集完成"
```

#### 2.2 配置GitHub Secrets
在 **Settings** → **Secrets and variables** → **Actions** 中添加:

| Secret名称 | 值 |
|------------|-----|
| `REDDIT_CLIENT_ID` | `NJnkQLyA6Gie7rGvCI3zYg` |
| `REDDIT_CLIENT_SECRET` | `WHFMSNNZBt1gV5xC394LGhrr5LzyPQ` |
| `CLOUDFLARE_API_TOKEN` | `WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU` |
| `ACCOUNT_ID` | `e23dc8a212c55fe9210b99f24be11eb9` |
| `DATABASE_ID` | `3d1a2cff-14ac-49e7-9bfd-b4a5606c9712` |

---

## 📊 当前状态

✅ **数据采集功能**: 完全正常  
✅ **手动执行**: 成功采集733条新帖子  
✅ **数据质量**: 平均分数178.5，覆盖26个社区  
⏳ **自动化**: 需要解决GitHub权限问题  

### 数据库最新状态
- **今日(2025-09-25)**: 683条帖子，26个社区
- **昨日(2025-09-24)**: 797条帖子，21个社区
- **增量采集**: 成功避免重复数据

---

## 🎯 下一步行动

1. **立即**: 按照方法1或方法2解决GitHub Actions权限问题
2. **测试**: 手动触发一次工作流验证自动化
3. **监控**: 确认明天10:00自动采集是否正常运行

---

## ✅ 结论

**核心功能完全正常** - 您的Reddit AI Collect v3.0项目运行良好，只需要解决GitHub Actions的权限配置即可实现完全自动化。
