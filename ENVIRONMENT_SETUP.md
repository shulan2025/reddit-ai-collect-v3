# 环境变量配置指南

## 📋 环境变量说明

Reddit AI Collect v2.0 需要以下环境变量才能正常运行：

### 🔑 必需的环境变量

#### Reddit API 配置
```bash
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret  
REDDIT_USER_AGENT=reddit-ai-collect_v2/2.0.0 (by /u/your_username)
```

#### Cloudflare 配置
```bash
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
ACCOUNT_ID=your_cloudflare_account_id
DATABASE_ID=your_d1_database_id
```

### ⚙️ 可选的环境变量 (有默认值)

```bash
# 采集配置
DAILY_LIMIT=2000                    # 每日采集上限
MAX_POSTS_PER_REQUEST=80           # 单次API请求最大帖子数
MIN_UPVOTE_RATIO=0.1               # 最小点赞率阈值
API_REQUEST_INTERVAL=1000          # API请求间隔 (毫秒)
MAX_RETRIES=3                      # 最大重试次数

# 环境配置
ENVIRONMENT=production             # 环境标识
```

## 🔧 本地开发配置

### 1. 创建本地环境文件
```bash
# 复制示例文件
cp .env.example .dev.vars

# 编辑环境变量
vim .dev.vars
```

### 2. 填入真实的API密钥
```bash
# .dev.vars 文件内容
REDDIT_CLIENT_ID=NJnkQLyA6Gie7rGvCI3zYg
REDDIT_CLIENT_SECRET=WHFMSNNZBt1gV5xC394LGhrr5LzyPQ
REDDIT_USER_AGENT=reddit-ai-collect_v2/2.0.0 (by /u/ai_researcher)
CLOUDFLARE_API_TOKEN=WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU
ACCOUNT_ID=e23dc8a212c55fe9210b99f24be11eb9
DATABASE_ID=3d1a2cff-14ac-49e7-9bfd-b4a5606c9712
```

## 🚀 生产环境配置

### 1. Cloudflare Workers 环境变量
```bash
# 使用 wrangler 设置密钥
npx wrangler secret put REDDIT_CLIENT_ID
npx wrangler secret put REDDIT_CLIENT_SECRET
npx wrangler secret put CLOUDFLARE_API_TOKEN

# 在 wrangler.toml 中设置非敏感变量
[vars]
ENVIRONMENT = "production"
DAILY_LIMIT = "2000"
MAX_POSTS_PER_REQUEST = "80"
MIN_UPVOTE_RATIO = "0.1"
API_REQUEST_INTERVAL = "1000"
MAX_RETRIES = "3"
```

### 2. GitHub Actions Secrets
在GitHub仓库的Settings > Secrets and variables > Actions中添加：

```
REDDIT_CLIENT_ID          # Reddit应用客户端ID
REDDIT_CLIENT_SECRET       # Reddit应用客户端密钥  
CLOUDFLARE_API_TOKEN       # Cloudflare API令牌
ACCOUNT_ID                 # Cloudflare账户ID
DATABASE_ID                # D1数据库ID
```

## 🔑 API密钥获取指南

### Reddit API密钥
1. 访问 https://www.reddit.com/prefs/apps
2. 点击 "Create App" 或 "Create Another App"
3. 填写应用信息：
   - **Name**: reddit-ai-collect_v2
   - **App type**: script
   - **Description**: AI帖子采集器
   - **About URL**: 留空
   - **Redirect URI**: http://localhost:8080
4. 获取 `client_id` 和 `client_secret`

### Cloudflare API令牌
1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 "Create Token"
3. 选择 "Custom token"
4. 配置权限：
   - **Account**: `Cloudflare D1:Edit`
   - **Zone Resources**: `Include - All zones`
5. 获取生成的API令牌

### Cloudflare账户和数据库ID
```bash
# 获取账户ID
npx wrangler whoami

# 获取数据库ID  
npx wrangler d1 list
```

## 🔍 环境变量验证

### 验证脚本
```bash
# 创建验证脚本
cat > verify-env.js << 'EOF'
const requiredVars = [
  'REDDIT_CLIENT_ID',
  'REDDIT_CLIENT_SECRET', 
  'CLOUDFLARE_API_TOKEN',
  'ACCOUNT_ID',
  'DATABASE_ID'
];

console.log('🔍 验证环境变量...');
let missing = [];

requiredVars.forEach(varName => {
  if (!process.env[varName]) {
    missing.push(varName);
  } else {
    console.log(`✅ ${varName}: ${process.env[varName].substring(0, 8)}...`);
  }
});

if (missing.length > 0) {
  console.log('❌ 缺少以下环境变量:');
  missing.forEach(varName => console.log(`   - ${varName}`));
  process.exit(1);
} else {
  console.log('✅ 所有必需的环境变量都已配置!');
}
EOF

# 运行验证
node verify-env.js
```

## 🛠️ 故障排除

### 常见问题

#### 1. Reddit API认证失败
```bash
# 错误信息: 401 Unauthorized
# 解决方案:
- 检查 REDDIT_CLIENT_ID 和 REDDIT_CLIENT_SECRET 是否正确
- 确认 User-Agent 格式正确
- 验证Reddit应用类型为 'script'
```

#### 2. Cloudflare D1连接失败
```bash
# 错误信息: Authentication error [code: 10000]
# 解决方案:
- 检查 CLOUDFLARE_API_TOKEN 权限
- 验证 ACCOUNT_ID 和 DATABASE_ID 正确
- 确认API令牌未过期
```

#### 3. 环境变量未加载
```bash
# 本地开发问题
# 解决方案:
- 确认 .dev.vars 文件存在
- 检查文件名和路径正确
- 验证文件格式 (KEY=VALUE，无空格)
```

### 调试命令
```bash
# 测试Reddit API连接
node -e "
const client_id = process.env.REDDIT_CLIENT_ID;
const client_secret = process.env.REDDIT_CLIENT_SECRET;
console.log('Client ID:', client_id ? 'OK' : 'Missing');
console.log('Client Secret:', client_secret ? 'OK' : 'Missing');
"

# 测试Cloudflare API连接
node -e "
const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.ACCOUNT_ID;
console.log('API Token:', token ? 'OK' : 'Missing');
console.log('Account ID:', account ? 'OK' : 'Missing');
"
```

## 🔒 安全最佳实践

### 1. 密钥管理
- ❌ **永远不要**将API密钥提交到Git仓库
- ✅ 使用环境变量或密钥管理服务
- ✅ 定期轮换API密钥
- ✅ 使用最小权限原则

### 2. 文件权限
```bash
# 设置环境文件权限
chmod 600 .dev.vars
chmod 600 .env.local

# 添加到 .gitignore
echo ".dev.vars" >> .gitignore
echo ".env.local" >> .gitignore
```

### 3. 密钥验证
```bash
# 验证密钥有效性
npm run health  # 检查系统健康状态
npm run db:stats  # 验证数据库连接
```

## 📚 参考链接

- [Reddit API文档](https://www.reddit.com/dev/api/)
- [Cloudflare Workers文档](https://developers.cloudflare.com/workers/)
- [Cloudflare D1文档](https://developers.cloudflare.com/d1/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

**记住**: 环境变量配置是项目正常运行的基础，请仔细检查每个变量的值和格式。
