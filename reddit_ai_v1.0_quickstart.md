# Reddit AI采集系统 v1.0 - 快速部署指南

## 🚀 5分钟快速启动

### 📋 前置条件

```bash
✅ Python 3.8+
✅ Reddit API账号 (免费)
✅ Cloudflare D1数据库 (免费)
✅ 网络连接
```

### 🔑 步骤1: 获取API密钥

#### Reddit API
```bash
1. 访问: https://www.reddit.com/prefs/apps
2. 点击 "Create App" 或 "Create Application"
3. 选择 "script" 类型
4. 记录 Client ID 和 Client Secret
```

#### Cloudflare D1
```bash
1. 登录 Cloudflare Dashboard
2. 左侧菜单 → Workers & Pages → D1
3. 创建数据库 → 记录 Database ID
4. API Token → 创建自定义Token
5. 记录 Account ID 和 API Token
```

### ⚙️ 步骤2: 环境配置

```bash
# 1. 克隆项目 (或下载文件)
cd /path/to/reddit-ai-crawler

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置环境变量
cp env_template.txt .env

# 4. 编辑 .env 文件
nano .env
```

#### .env 配置示例
```bash
# Reddit API 配置
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=Reddit_AI_Daily_Collector_v1.0

# Cloudflare D1 数据库配置
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
D1_DATABASE_ID=your_database_id

# 采集配置
DAILY_TARGET_POSTS=200
COLLECTION_HOUR=6
COLLECTION_TIMEZONE=Asia/Shanghai
```

### 🗄️ 步骤3: 初始化数据库

```bash
# 初始化Cloudflare D1数据表
python3 init_d1_tables.py

# 验证数据库连接
python3 test_d1_connection.py
```

### 🧪 步骤4: 测试运行

```bash
# 测试Reddit API连接
python3 test_reddit_api.py

# 测试完整采集流程
python3 main.py collect

# 预期输出: 采集80-150个AI帖子
```

### 🔄 步骤5: 启动自动化

```bash
# 启动定时调度器 (后台运行)
python3 main.py scheduler start &

# 启动实时监控面板
python3 continuous_monitor.py
```

---

## 📊 验证部署成功

### ✅ 检查清单

```bash
□ Reddit API连接正常
□ Cloudflare D1数据库初始化完成
□ 测试采集获得50+个帖子
□ 定时调度器启动成功
□ 监控面板显示正常
```

### 🖥️ 监控界面示例

```
🖥️  Reddit AI内容采集系统 - 实时监控面板
=================================================================
⏰ 当前时间: 2025-09-06 15:30:00 CST

📊 系统状态: 🟢 优秀 (健康度: 78/100)

📈 核心采集指标
-----------------------------------
📅 今日采集: 156/200 (78.0%)
📊 累计总量: 156 个帖子
⭐ 平均质量: 67.0/100
🎯 今日进度: [████████████████░░░░] 78.0%

📍 活跃子版块 TOP 5
-----------------------------------
  1. r/ChatGPT: 38 个 (24.4%)
  2. r/LocalLLaMA: 33 个 (21.2%)
  3. r/StableDiffusion: 30 个 (19.2%)
  4. r/singularity: 16 个 (10.3%)
  5. r/artificial: 15 个 (9.6%)
```

---

## 🛠️ 常用命令

### 📱 系统管理
```bash
# 查看系统状态
python3 main.py monitor

# 查看数据库状态
python3 main.py database status

# 查看调度器状态  
python3 main.py scheduler status

# 生成详细报告
python3 generate_report.py
```

### 🔧 手动操作
```bash
# 手动执行一次采集
python3 main.py collect

# 停止调度器
python3 main.py scheduler stop

# 清理旧数据 (可选)
python3 main.py database cleanup
```

---

## 🚨 故障排除

### 常见问题

#### 1. Reddit API错误
```bash
错误: 401 Unauthorized
解决: 检查Client ID和Secret是否正确

错误: 429 Too Many Requests  
解决: 等待几分钟，Reddit有频率限制
```

#### 2. 数据库连接失败
```bash
错误: Database not found
解决: 检查D1 Database ID是否正确

错误: API Token invalid
解决: 重新生成Cloudflare API Token
```

#### 3. 采集量偏低
```bash
原因: 门槛设置过高
解决: 编辑daily_collection_config.py，降低min_score值

原因: 网络问题
解决: 检查网络连接，重试执行
```

### 📞 获取帮助

```bash
# 查看详细日志
tail -f logs/reddit_crawler.log

# 检查配置文件
python3 daily_collection_config.py

# 验证环境配置
python3 config.py
```

---

## 📈 性能优化建议

### 🎯 提升采集量
```bash
1. 降低门槛: 编辑daily_collection_config.py
   - min_score: 降到10-30
   - min_comments: 降到1-3

2. 增加排序方式:
   - sort_methods: ["hot", "top", "new", "rising"]

3. 调整采集时间:
   - 选择Reddit活跃时段 (美东时间8-12点)
```

### ⚡ 提升系统性能
```bash
1. 网络优化:
   - 使用稳定网络连接
   - 配置代理 (如需要)

2. 数据库优化:
   - 定期清理旧数据
   - 监控D1配额使用

3. 资源管理:
   - 监控系统内存使用
   - 定期重启长时间运行的进程
```

---

## 🎯 生产环境部署

### 🐳 Docker部署 (推荐)
```bash
# 构建镜像
docker build -t reddit-ai-crawler .

# 运行容器
docker run -d \
  --name reddit-ai \
  --env-file .env \
  --restart unless-stopped \
  reddit-ai-crawler

# 查看日志
docker logs -f reddit-ai
```

### ☁️ 云服务器部署
```bash
# VPS推荐配置
CPU: 1核心
内存: 1GB
存储: 10GB
系统: Ubuntu 20.04+

# 自动启动设置
sudo crontab -e
# 添加: @reboot cd /path/to/project && python3 main.py scheduler start
```

### 📊 监控告警
```bash
# 设置采集失败告警
python3 setup_alerts.py

# 集成监控平台 (可选)
- Prometheus + Grafana
- Datadog
- New Relic
```

---

## ✅ 部署成功标准

### 🎯 核心指标
- ✅ 每日采集量: 120+ 个帖子
- ✅ 系统健康度: 70+ 分
- ✅ 社区覆盖率: 8+ 个社区
- ✅ 平均质量分: 60+ 分
- ✅ 系统稳定性: 连续运行7天+

### 📊 质量基准
- ✅ AI相关性: 90%+ 准确率
- ✅ 内容重复率: <5%
- ✅ API调用效率: <100次/日
- ✅ 数据完整性: 100%

**🎉 恭喜！Reddit AI内容采集系统v1.0已成功部署！**

现在系统将每日自动为您采集高质量的AI前沿资讯！

---
*快速部署指南 v1.0 | 预计部署时间: 5-10分钟*
