# GitHub Secrets 配置检查清单

## 🔐 必需配置的Secrets

### Reddit API 配置
```
✅ REDDIT_CLIENT_ID
   值: NJnkQLyA6Gie7rGvCI3zYg
   说明: Reddit应用客户端ID

✅ REDDIT_CLIENT_SECRET  
   值: WHFMSNNZBt1gV5xC394LGhrr5LzyPQ
   说明: Reddit应用客户端密钥

✅ REDDIT_USER_AGENT
   值: reddit-ai-collect_v3/3.0.0 (by /u/ai_researcher)
   说明: Reddit API用户代理字符串
```

### Cloudflare 配置
```
✅ CLOUDFLARE_API_TOKEN
   值: WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU
   说明: Cloudflare API访问令牌

✅ CLOUDFLARE_ACCOUNT_ID
   值: e23dc8a212c55fe9210b99f24be11eb9
   说明: Cloudflare账户ID

✅ CLOUDFLARE_D1_DATABASE_ID
   值: 3d1a2cff-14ac-49e7-9bfd-b4a5606c9712
   说明: D1数据库ID
```

### Google AI (可选)
```
✅ GOOGLE_AI_API_KEY
   值: AIzaSyBqiSrxMcYrYtqjCVYTMnO7YkLxBcBWRrQ
   说明: Google AI Studio API密钥 (用于高级AI检测)
```

## 📝 配置步骤

### 1. 进入GitHub仓库设置
1. 打开您的GitHub仓库页面
2. 点击 **Settings** 选项卡
3. 在左侧菜单中选择 **Secrets and variables** → **Actions**

### 2. 添加每个Secret
对于上述每个Secret：
1. 点击 **New repository secret** 按钮
2. 在 **Name** 字段输入Secret名称 (如: REDDIT_CLIENT_ID)
3. 在 **Secret** 字段输入对应的值
4. 点击 **Add secret** 保存

### 3. 验证配置
配置完成后，您应该在Secrets页面看到7个已配置的Secrets：

```
Repository secrets (7)
├── REDDIT_CLIENT_ID ●●●●●●●●●●●●●●●●●●●●
├── REDDIT_CLIENT_SECRET ●●●●●●●●●●●●●●●●●●●●  
├── REDDIT_USER_AGENT ●●●●●●●●●●●●●●●●●●●●
├── CLOUDFLARE_API_TOKEN ●●●●●●●●●●●●●●●●●●●●
├── CLOUDFLARE_ACCOUNT_ID ●●●●●●●●●●●●●●●●●●●●
├── CLOUDFLARE_D1_DATABASE_ID ●●●●●●●●●●●●●●●●●●●●
└── GOOGLE_AI_API_KEY ●●●●●●●●●●●●●●●●●●●●
```

## ⚠️ 安全注意事项

### 🔒 Secret安全
- **永远不要**在代码中硬编码这些值
- **永远不要**在公开场所分享这些密钥
- 定期轮换API密钥以提高安全性
- 使用最小权限原则

### 🛡️ 访问控制
- 只有仓库管理员可以查看和修改Secrets
- GitHub Actions可以访问这些Secrets
- Secrets在日志中会被自动遮蔽显示

## 🔧 故障排除

### 常见问题
1. **Secret名称错误**: 确保名称完全匹配，区分大小写
2. **值包含空格**: 确保复制粘贴时没有多余的空格
3. **权限不足**: 确保您有仓库的管理员权限

### 验证方法
配置完成后，可以通过以下方式验证：
1. 手动触发GitHub Actions工作流
2. 查看Actions运行日志是否有认证错误
3. 检查Cloudflare Workers是否成功部署

## 📋 配置完成检查清单

### ✅ Reddit API Secrets
- [ ] REDDIT_CLIENT_ID 已配置
- [ ] REDDIT_CLIENT_SECRET 已配置  
- [ ] REDDIT_USER_AGENT 已配置

### ✅ Cloudflare Secrets
- [ ] CLOUDFLARE_API_TOKEN 已配置
- [ ] CLOUDFLARE_ACCOUNT_ID 已配置
- [ ] CLOUDFLARE_D1_DATABASE_ID 已配置

### ✅ 可选Secrets
- [ ] GOOGLE_AI_API_KEY 已配置

### ✅ 验证测试
- [ ] 所有7个Secrets在GitHub页面可见
- [ ] Secret名称拼写正确
- [ ] 没有多余的空格或特殊字符
- [ ] 准备进行首次部署测试

---

**🎯 完成以上配置后，Reddit AI Collect v3.0就可以通过GitHub Actions自动部署和运行了！**
