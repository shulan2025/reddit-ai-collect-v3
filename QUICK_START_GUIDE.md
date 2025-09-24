# Reddit AI Collect v3.0 快速开始指南

## 🚀 5分钟快速部署

### 第1步：创建GitHub仓库 (1分钟)
1. 访问 [GitHub](https://github.com) 并登录
2. 点击右上角 "+" → "New repository"
3. 仓库名称: `reddit-ai-collect-v3`
4. 选择 Private 或 Public
5. **不要**勾选 "Add a README file"
6. 点击 "Create repository"

### 第2步：上传代码 (1分钟)
在项目目录中运行：
```bash
# 使用自动化脚本
./scripts/github-setup.sh

# 或者手动执行
git init
git add .
git commit -m "🎉 Reddit AI Collect v3.0 初始版本"
git remote add origin https://github.com/YOUR_USERNAME/reddit-ai-collect-v3.git
git branch -M main
git push -u origin main
```

### 第3步：配置Secrets (2分钟)
在GitHub仓库页面：
1. Settings → Secrets and variables → Actions
2. 添加以下7个Secrets：

| Secret名称 | 值 |
|------------|-----|
| `REDDIT_CLIENT_ID` | `NJnkQLyA6Gie7rGvCI3zYg` |
| `REDDIT_CLIENT_SECRET` | `WHFMSNNZBt1gV5xC394LGhrr5LzyPQ` |
| `REDDIT_USER_AGENT` | `reddit-ai-collect_v3/3.0.0 (by /u/ai_researcher)` |
| `CLOUDFLARE_API_TOKEN` | `WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU` |
| `CLOUDFLARE_ACCOUNT_ID` | `e23dc8a212c55fe9210b99f24be11eb9` |
| `CLOUDFLARE_D1_DATABASE_ID` | `3d1a2cff-14ac-49e7-9bfd-b4a5606c9712` |
| `GOOGLE_AI_API_KEY` | `AIzaSyBqiSrxMcYrYtqjCVYTMnO7YkLxBcBWRrQ` |

### 第4步：启动自动化 (1分钟)
1. 进入 Actions 页面
2. 点击 "I understand my workflows, go ahead and enable them"
3. 选择 "Deploy Reddit AI Collect v3.0" 工作流
4. 点击 "Run workflow" → "Run workflow"

## ✅ 验证部署成功

### 检查部署状态
1. 在 Actions 页面查看工作流状态
2. 绿色 ✅ = 成功，红色 ❌ = 失败
3. 点击运行记录查看详细日志

### 测试Worker功能
```bash
# 健康检查
curl https://reddit-ai-crawler-v2.xiaoyan-chen222.workers.dev/health

# 查看统计
curl https://reddit-ai-crawler-v2.xiaoyan-chen222.workers.dev/stats
```

## 📅 每日自动运行

### 自动执行时间
- **时间**: 每天北京时间上午10:00 (UTC 2:00)
- **模式**: 增量采集 (只获取新帖子)
- **预期**: 每天采集100-500条新帖子

### 监控方式
1. **GitHub Actions**: 查看每日运行状态
2. **邮件通知**: 失败时自动发送邮件
3. **数据查询**: 检查数据库最新数据

## 🛠️ 常用操作

### 手动触发采集
1. 进入 Actions → "Daily Reddit AI Collect v3.0 Incremental Crawl"
2. 点击 "Run workflow"
3. 选择采集类型和数量
4. 点击 "Run workflow"

### 查看采集结果
```bash
# 查看今日采集数量
npm run db:query "SELECT COUNT(*) FROM redditV2_posts WHERE collection_date = date('now');"

# 查看总数据量
npm run stats
```

### 调整采集时间
编辑 `.github/workflows/daily-crawl-v2.yml` 中的 cron 表达式：
```yaml
# 每天UTC 2:00 (北京时间10:00)
- cron: '0 2 * * *'

# 每天UTC 14:00 (北京时间22:00)  
- cron: '0 14 * * *'

# 工作日UTC 2:00
- cron: '0 2 * * 1-5'
```

## 🔧 故障排除

### 常见问题
1. **部署失败**: 检查Secrets配置
2. **采集失败**: 检查Reddit API密钥
3. **数据库错误**: 检查Cloudflare配置

### 调试步骤
1. 查看Actions运行日志
2. 检查Worker部署状态
3. 验证数据库连接
4. 测试API密钥有效性

### 紧急处理
如果出现问题：
1. 暂时禁用工作流：Actions → 工作流 → "..." → "Disable workflow"
2. 修复问题后重新推送代码
3. 重新启用工作流

## 📊 性能监控

### 关键指标
- **采集成功率**: >95%
- **平均执行时间**: <10分钟
- **数据质量**: 平均分数>50
- **重复率**: <5%

### 优化建议
1. 使用增量采集而非完整采集
2. 监控API限制和错误率
3. 定期检查数据质量
4. 根据需要调整过滤条件

## 🎯 完成检查清单

### ✅ 基础设置
- [ ] GitHub仓库已创建
- [ ] 代码已上传
- [ ] 所有Secrets已配置
- [ ] GitHub Actions已启用

### ✅ 部署验证
- [ ] 首次部署工作流成功运行
- [ ] Cloudflare Worker可访问
- [ ] 数据库连接正常
- [ ] 健康检查通过

### ✅ 自动化确认
- [ ] 每日采集工作流配置正确
- [ ] 时间设置符合需求
- [ ] 通知设置已完成
- [ ] 监控方式已了解

---

**🎉 恭喜！Reddit AI Collect v3.0现在将每天自动采集AI相关帖子！**

如需帮助，请查看详细文档或GitHub Actions日志。
