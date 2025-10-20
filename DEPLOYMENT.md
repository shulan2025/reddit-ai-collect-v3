# Reddit AI Crawler 部署指南

## 📋 部署前准备

### 1. 环境要求
- Node.js 18+ 
- npm 或 yarn
- Cloudflare账户
- Reddit API应用

### 2. 账户信息确认
确保您有以下信息：

**Cloudflare 信息:**
- Account ID: `e23dc8a212c55fe9210b99f24be11eb9`
- D1 Database ID: `3d1a2cff-14ac-49e7-9bfd-b4a5606c9712`
- Database Name: `reddit-ai-crawler`

**Reddit API 信息:**
- Client ID: `NJnkQLyA6Gie7rGvCI3zYg`
- Client Secret: `WHFMSNNZBt1gV5xC394LGhrr5LzyPQ`

## 🚀 快速部署

### 方法一：自动化部署（推荐）

1. **运行部署前检查**
```bash
./scripts/pre-deploy-check.sh
```

2. **执行自动化部署**
```bash
npm run deploy
```

### 方法二：手动部署

1. **安装依赖**
```bash
npm install
```

2. **Cloudflare登录**
```bash
npx wrangler login
```

3. **应用数据库迁移**
```bash
npm run db:migrate
```

4. **设置API密钥**
```bash
# Reddit API密钥
echo "NJnkQLyA6Gie7rGvCI3zYg" | npx wrangler secret put REDDIT_CLIENT_ID
echo "WHFMSNNZBt1gV5xC394LGhrr5LzyPQ" | npx wrangler secret put REDDIT_CLIENT_SECRET
echo "reddit-ai-crawler/1.0.0 (by /u/ai_researcher)" | npx wrangler secret put REDDIT_USER_AGENT

# Google AI API密钥（可选）
# echo "your-google-ai-key" | npx wrangler secret put GOOGLE_AI_API_KEY
```

5. **部署到Cloudflare Workers**
```bash
npx wrangler deploy
```

## 📊 部署后验证

### 1. 健康检查
```bash
curl https://reddit-ai-crawler-v2.your-subdomain.workers.dev/health
```

预期响应：
```json
{
  "status": "healthy",
  "checks": {
    "database": "healthy",
    "reddit_api": "healthy",
    "environment": "healthy"
  }
}
```

### 2. 手动触发采集测试
```bash
curl -X POST https://reddit-ai-crawler-v2.your-subdomain.workers.dev/crawl
```

### 3. 查看系统状态
```bash
curl https://reddit-ai-crawler-v2.your-subdomain.workers.dev/status
```

### 4. 查看采集统计
```bash
curl https://reddit-ai-crawler-v2.your-subdomain.workers.dev/stats
```

## 🔧 配置说明

### 核心配置参数
- **每日采集限制**: 2000条帖子
- **单次API调用限制**: 80条帖子
- **最小点赞率**: 0.1
- **API请求间隔**: 1000ms
- **定时执行**: 每日UTC 2:00 (北京时间10:00)

### 目标社区 (29个)
**Tier 1 高优先级 (5个):**
- MachineLearning, artificial, deeplearning, LocalLLaMA, ChatGPT

**Tier 2 中优先级 (8个):**
- OpenAI, computervision, NLP, MLPapers, StableDiffusion, ArtificialInteligence, singularity, AI_Agents

**Tier 3 标准优先级 (16个):**
- agi, neuralnetworks, datasets, voiceai, MediaSynthesis, GPT3, grok, ClaudeAI, aivideo, IndianArtAI, gameai, GoogleGeminiAI, NovelAi, KindroidAI, WritingWithAI, Qwen_AI

## 📈 监控和维护

### 1. 查看实时日志
```bash
npm run tail
```

### 2. 数据库查询
```bash
# 查看今日采集统计
npm run db:stats

# 自定义查询
npx wrangler d1 execute reddit-ai-crawler --command "SELECT COUNT(*) FROM reddit_posts WHERE collection_date = date('now')"
```

### 3. 常用监控命令
```bash
# 健康检查
npm run health

# 系统状态
npm run status

# 采集统计
npm run stats

# 手动触发采集
npm run crawl:trigger
```

## 🛠️ 故障排除

### 常见问题

1. **Reddit API认证失败**
   - 检查Client ID和Secret是否正确
   - 确认User Agent格式正确
   - 验证API密钥未过期

2. **数据库连接失败**
   - 确认Database ID正确
   - 检查数据库迁移是否执行成功
   - 验证Cloudflare账户权限

3. **定时任务未执行**
   - 检查cron配置：`[triggers] crons = ["0 2 * * *"]`
   - 查看Worker日志确认触发情况
   - 验证Worker部署状态

4. **配额用完**
   - 检查每日限制设置
   - 查看配额使用情况：`/status` 端点
   - 调整社区配额分配

### 调试命令
```bash
# 查看详细日志
npx wrangler tail --format=pretty

# 本地开发测试
npm run dev

# 检查配置
cat wrangler.toml

# 验证数据库结构
npx wrangler d1 execute reddit-ai-crawler --command ".schema"
```

## 📋 维护任务

### 每周检查
- [ ] 查看错误日志：`SELECT * FROM error_logs WHERE resolved = FALSE`
- [ ] 检查采集统计：`SELECT * FROM daily_summary ORDER BY summary_date DESC LIMIT 7`
- [ ] 验证配额使用情况
- [ ] 检查系统健康状态

### 每月维护
- [ ] 清理90天前的旧数据
- [ ] 更新社区配置（如需要）
- [ ] 检查API密钥有效期
- [ ] 优化数据库性能

## 🔄 更新部署

当需要更新代码时：

1. **更新代码**
```bash
git pull origin main
```

2. **快速重新部署**
```bash
npm run deploy:quick
```

3. **完整重新部署（包含密钥）**
```bash
npm run deploy
```

## 📞 支持

如遇到问题，请检查：
1. Cloudflare Workers仪表板
2. D1数据库控制台
3. Worker日志输出
4. Reddit API状态页面

---

**部署完成后，系统将自动开始每日采集AI相关Reddit帖子！** 🎉
