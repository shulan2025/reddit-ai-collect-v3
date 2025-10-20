# Reddit AI Collect v3.0 GitHub上传和自动化指南

## 🚀 第一步：创建GitHub仓库并上传代码

### 1.1 在GitHub上创建新仓库
1. 访问 [GitHub](https://github.com)
2. 点击右上角的 "+" 按钮，选择 "New repository"
3. 填写仓库信息：
   - **Repository name**: `reddit-ai-collect-v3`
   - **Description**: `Reddit AI帖子采集器 v3.0 - 修复URL字段，完善帖子链接处理`
   - **Visibility**: Private (推荐) 或 Public
   - **不要**勾选 "Add a README file" (我们已有README)
4. 点击 "Create repository"

### 1.2 初始化本地Git仓库并上传
```bash
# 在项目根目录执行以下命令
cd /Users/momo/Desktop/陌陌文档工作台/AI/reddit-ai-crawler-v2

# 初始化Git仓库
git init

# 添加所有文件
git add .

# 创建初始提交
git commit -m "🎉 Reddit AI Collect v3.0 初始版本

✅ 主要特性:
- 修复URL字段问题，新增post_url字段
- 支持增量和完整数据采集
- 完善的错误处理和测试框架
- 100%向后兼容

🔧 技术栈:
- Cloudflare Workers + D1 Database
- TypeScript + Node.js
- GitHub Actions自动化部署
- 29个AI社区数据采集"

# 添加远程仓库 (替换为您的GitHub用户名)
git remote add origin https://github.com/YOUR_USERNAME/reddit-ai-collect-v3.git

# 推送到GitHub
git branch -M main
git push -u origin main
```

## 🔐 第二步：配置GitHub Secrets

### 2.1 必需的Secrets配置
在GitHub仓库中配置以下Secrets：

1. 进入GitHub仓库页面
2. 点击 "Settings" 选项卡
3. 左侧菜单选择 "Secrets and variables" → "Actions"
4. 点击 "New repository secret" 添加以下密钥：

#### Reddit API密钥
```
名称: REDDIT_CLIENT_ID
值: NJnkQLyA6Gie7rGvCI3zYg

名称: REDDIT_CLIENT_SECRET  
值: WHFMSNNZBt1gV5xC394LGhrr5LzyPQ

名称: REDDIT_USER_AGENT
值: reddit-ai-collect_v3/3.0.0 (by /u/ai_researcher)
```

#### Cloudflare配置
```
名称: CLOUDFLARE_API_TOKEN
值: WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU

名称: CLOUDFLARE_ACCOUNT_ID
值: e23dc8a212c55fe9210b99f24be11eb9

名称: CLOUDFLARE_D1_DATABASE_ID
值: 3d1a2cff-14ac-49e7-9bfd-b4a5606c9712
```

#### Google AI API (可选)
```
名称: GOOGLE_AI_API_KEY
值: AIzaSyBqiSrxMcYrYtqjCVYTMnO7YkLxBcBWRrQ
```

### 2.2 验证Secrets配置
配置完成后，您应该看到以下7个Secrets：
- ✅ REDDIT_CLIENT_ID
- ✅ REDDIT_CLIENT_SECRET  
- ✅ REDDIT_USER_AGENT
- ✅ CLOUDFLARE_API_TOKEN
- ✅ CLOUDFLARE_ACCOUNT_ID
- ✅ CLOUDFLARE_D1_DATABASE_ID
- ✅ GOOGLE_AI_API_KEY

## ⏰ 第三步：设置每日定时任务

### 3.1 GitHub Actions工作流已配置
项目中已包含两个GitHub Actions工作流：

#### 🚀 部署工作流 (`.github/workflows/deploy.yml`)
- **触发条件**: 推送到main分支时自动部署
- **功能**: 自动部署到Cloudflare Workers

#### 📅 每日采集工作流 (`.github/workflows/daily-crawl-v2.yml`)
- **触发条件**: 每天UTC 2:00 (北京时间10:00)
- **功能**: 执行增量数据采集

### 3.2 启用GitHub Actions
1. 在GitHub仓库页面，点击 "Actions" 选项卡
2. 如果提示启用Actions，点击 "I understand my workflows, go ahead and enable them"
3. 您将看到两个工作流：
   - "Deploy Reddit AI Collect v2.0"
   - "Daily Reddit AI Collect v2.0 Incremental Crawl"

### 3.3 手动触发测试
首次设置后，建议手动测试：

1. 进入 "Actions" 页面
2. 选择 "Deploy Reddit AI Collect v2.0" 工作流
3. 点击 "Run workflow" 按钮
4. 选择 main 分支，点击 "Run workflow"

## 🔧 第四步：验证自动化部署

### 4.1 检查部署状态
1. 在 "Actions" 页面查看工作流运行状态
2. 绿色 ✅ 表示成功，红色 ❌ 表示失败
3. 点击具体的运行记录查看详细日志

### 4.2 验证Cloudflare Workers部署
```bash
# 检查Worker健康状态
curl https://reddit-ai-crawler-v2.xiaoyan-chen222.workers.dev/health

# 查看采集统计
curl https://reddit-ai-crawler-v2.xiaoyan-chen222.workers.dev/stats
```

### 4.3 验证数据库连接
部署成功后，数据库迁移会自动执行，包括：
- 创建redditV2_posts表（含post_url字段）
- 创建索引优化查询性能
- 配置环境变量

## 📊 第五步：监控每日运行

### 5.1 每日采集时间表
- **执行时间**: 每天UTC 2:00 (北京时间10:00)
- **采集模式**: 增量采集（只获取新帖子）
- **预期数量**: ~100-500新帖子/天
- **执行时长**: ~5-10分钟

### 5.2 监控方式
1. **GitHub Actions页面**: 查看每日运行状态
2. **邮件通知**: GitHub会发送失败通知邮件
3. **数据库查询**: 检查最新采集数据

### 5.3 常用监控命令
```bash
# 查看最新采集数据
npm run db:query "SELECT COUNT(*) as today_posts FROM redditV2_posts WHERE collection_date = date('now');"

# 查看采集统计
npm run stats

# 手动触发增量采集
npm run crawl:incremental
```

## 🛠️ 第六步：自定义配置

### 6.1 调整采集时间
编辑 `.github/workflows/daily-crawl-v2.yml`：
```yaml
on:
  schedule:
    # 修改这里的cron表达式
    # 格式: 分 时 日 月 周 (UTC时间)
    - cron: '0 2 * * *'  # 每天UTC 2:00
```

常用时间示例：
- `'0 2 * * *'` - 每天UTC 2:00 (北京时间10:00)
- `'0 14 * * *'` - 每天UTC 14:00 (北京时间22:00)
- `'0 2 * * 1-5'` - 工作日UTC 2:00

### 6.2 调整采集参数
编辑 `wrangler.toml` 中的环境变量：
```toml
[vars]
DAILY_LIMIT = "2000"           # 每日采集上限
MAX_POSTS_PER_REQUEST = "80"   # 单次请求最大帖子数
MIN_UPVOTE_RATIO = "0.1"       # 最小点赞率
```

### 6.3 添加新的社区
编辑 `src/config/subreddits.json` 添加新的Reddit社区。

## 🚨 第七步：故障排除

### 7.1 常见问题
1. **部署失败**：检查Secrets配置是否正确
2. **采集失败**：检查Reddit API密钥是否有效
3. **数据库错误**：检查Cloudflare D1配置

### 7.2 调试方法
```bash
# 本地测试采集
npm run crawl:incremental

# 检查环境变量
npm run health

# 查看详细日志
npm run tail
```

### 7.3 紧急修复
如果自动化出现问题：
1. 暂时禁用GitHub Actions工作流
2. 本地修复问题后重新推送
3. 重新启用工作流

## 📈 第八步：性能优化建议

### 8.1 监控指标
- **采集成功率**: 目标 >95%
- **数据质量**: 平均分数 >50
- **执行时间**: <10分钟
- **重复率**: <5%

### 8.2 优化策略
1. **增量采集优先**: 避免使用完整采集
2. **错误重试**: 自动处理临时网络问题
3. **智能限流**: 根据API响应调整请求频率
4. **数据去重**: 避免重复存储相同帖子

## 🎯 完成检查清单

### ✅ GitHub设置
- [ ] 创建GitHub仓库
- [ ] 上传v3.0代码
- [ ] 配置所有必需的Secrets
- [ ] 启用GitHub Actions

### ✅ 自动化验证  
- [ ] 手动触发部署工作流成功
- [ ] Cloudflare Workers部署成功
- [ ] 数据库迁移完成
- [ ] 健康检查通过

### ✅ 每日任务设置
- [ ] 每日采集工作流配置正确
- [ ] 时间设置符合需求
- [ ] 通知设置完成

---

**🎉 完成以上步骤后，Reddit AI Collect v3.0将自动每日运行，持续采集AI相关帖子！**

如有问题，请查看GitHub Actions的运行日志或联系技术支持。
