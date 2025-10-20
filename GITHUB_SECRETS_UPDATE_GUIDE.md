# 🔐 GitHub Secrets 更新指南

## ✅ API验证成功

你的新Reddit API凭证已经过验证，可以正常工作！

**验证结果：**
- ✅ 访问令牌获取成功
- ✅ API访问测试通过  
- ✅ 成功获取Reddit帖子数据
- ✅ 速率限制：剩余997次请求

## 📋 需要更新的GitHub Secrets

### 1. 访问GitHub仓库设置
1. 登录GitHub
2. 访问你的仓库（如：`https://github.com/shulan2025/reddit-ai-collect-v3`）
3. 点击 **Settings** 标签
4. 在左侧菜单选择 **Secrets and variables** > **Actions**

### 2. 更新以下Secrets

#### REDDIT_CLIENT_ID
```
Z_hHdJ0RjsscpH23CCQM1g
```
- 点击 `REDDIT_CLIENT_ID` 旁的 **Update** 按钮
- 替换为新值
- 点击 **Update secret**

#### REDDIT_CLIENT_SECRET
```
PmkHamAUqeM8RY16rfKfczK-M51G2Q
```
- 点击 `REDDIT_CLIENT_SECRET` 旁的 **Update** 按钮
- 替换为新值
- 点击 **Update secret**

#### REDDIT_USER_AGENT
```
script:re_ai_collector_v4:v4.0.0 (by /u/shulan22)
```
- 点击 `REDDIT_USER_AGENT` 旁的 **Update** 按钮
- 替换为新值
- 点击 **Update secret**

### 3. 验证Cloudflare配置

以下配置应该保持不变（除非你有新的token）：

#### CLOUDFLARE_API_TOKEN
- 如果之前的token已失效，需要创建新的
- 访问: https://dash.cloudflare.com/profile/api-tokens
- 创建具有D1数据库编辑权限的token

#### ACCOUNT_ID
```
e23dc8a212c55fe9210b99f24be11eb9
```
（保持不变）

#### DATABASE_ID
```
3d1a2cff-14ac-49e7-9bfd-b4a5606c9712
```
（保持不变，但注意这个数据库缺少`redditV2_posts`表）

## 📤 提交代码更改到GitHub

### 步骤1: 检查更改
```bash
cd /Users/momo/Desktop/陌陌文档工作台/AI/Reddit_AI_Collect_v4.0_Final
git status
```

### 步骤2: 添加更改
```bash
git add .
```

### 步骤3: 提交更改
```bash
git commit -m "Update Reddit API credentials and restore crawling with conservative rates"
```

### 步骤4: 推送到GitHub
```bash
git push origin main
```

## 🧪 测试采集任务

### 方法1: 手动触发GitHub Actions
1. 访问你的仓库
2. 点击 **Actions** 标签
3. 选择 **Daily Reddit AI Collect v3.0** 工作流
4. 点击右侧的 **Run workflow** 按钮
5. 选择分支（main）
6. 点击 **Run workflow** 开始执行

### 方法2: 使用本地测试脚本
```bash
# 设置环境变量
export REDDIT_CLIENT_ID="Z_hHdJ0RjsscpH23CCQM1g"
export REDDIT_CLIENT_SECRET="PmkHamAUqeM8RY16rfKfczK-M51G2Q"
export REDDIT_USER_AGENT="script:re_ai_collector_v4:v4.0.0 (by /u/shulan22)"

# 运行测试采集
node incremental-crawl.js
```

## 📊 监控采集状态

### 检查GitHub Actions日志
1. 访问 **Actions** 标签
2. 查看最新的工作流运行
3. 点击运行记录查看详细日志
4. 重点关注:
   - Reddit API认证是否成功
   - 采集到的帖子数量
   - 是否有错误信息

### 关键指标
- **成功率**: 应该 > 95%
- **采集数量**: 每次运行应该有新数据
- **API限制**: 剩余请求数应该充足
- **错误率**: 应该 < 5%

## ⚙️ 新的采集策略

为了避免再次触发Reddit限制，我们已经实施了保守的配置：

### 速率限制
- 每分钟最多30次请求（原来60次）
- 每小时最多300次请求（原来3600次）
- 最小请求间隔2秒（原来1秒）

### 采集范围
- 每个subreddit采集20帖（原来35帖）
- 只采集最近7天的帖子（原来30天）
- 减少目标社区数量

### 质量过滤
- 最低评分: 10
- 最低评论数: 5
- 最低点赞率: 60%

## 🚨 故障处理

### 如果遇到问题

1. **API认证失败**
   ```bash
   # 运行验证脚本检查
   node verify-final-credentials.js
   ```

2. **再次被封禁**
   ```bash
   # 立即停止采集
   ./emergency-stop.sh
   
   # 等待24-72小时后重试
   ```

3. **数据库错误**
   - 检查Cloudflare API Token是否有效
   - 确认数据库表结构是否正确
   - 查看D1数据库日志

## ✅ 完成检查清单

在正式启用采集任务前，请确认：

- [ ] 已更新所有GitHub Secrets
- [ ] 已提交并推送代码到GitHub
- [ ] 已测试Reddit API访问
- [ ] 已检查Cloudflare D1连接
- [ ] 已查看GitHub Actions工作流状态
- [ ] 已了解新的采集速率限制
- [ ] 已设置监控和告警
- [ ] 已准备好emergency-stop.sh脚本

## 📞 支持资源

- **验证脚本**: `verify-final-credentials.js`
- **紧急停止**: `emergency-stop.sh`
- **配置文件**: `credentials.txt`
- **采集配置**: `conservative-crawl-config.js`
- **恢复脚本**: `restore-crawling.sh`

---

**祝采集顺利！** 🎉

如有任何问题，请随时检查日志或运行相关验证脚本。
