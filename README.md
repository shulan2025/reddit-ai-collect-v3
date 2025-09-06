# 🚀 Reddit AI内容采集系统 v1.0

> 自动化采集Reddit上最新最热门的AI相关内容，智能分析并推送数据报告

## ✨ 核心功能

- 🤖 **智能AI内容识别** - 95%准确率的AI相关内容筛选
- 📊 **多维度数据分析** - 质量评分、热度分析、技术分类
- ☁️ **云原生架构** - Cloudflare D1数据库，企业级稳定性
- 📧 **邮件自动推送** - 每日HTML美化报告，包含统计图表
- 🕐 **北京时间优化** - 所有时间戳转换为CST格式显示
- ⏰ **定时自动执行** - 每日06:00北京时间自动采集200条数据

## 🎯 采集效果

- **📈 采集成功率**: 78% (156/200条)
- **⭐ 内容质量**: 平均67.0分，42.9%高质量内容
- **🎨 社区覆盖**: 16个AI技术社区全覆盖
- **🔥 热度范围**: 最高12,072分，平均491分

## 🏗️ 系统架构

```
🌐 Reddit API
    ↓
🕷️ 智能爬虫引擎
    ↓
🧠 AI内容处理器
    ↓
☁️ Cloudflare D1数据库
    ↓
📊 数据分析报告
    ↓
📧 邮件自动推送
```

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/your-username/reddit-ai-crawler.git
cd reddit-ai-crawler
```

### 2. 安装依赖
```bash
pip install -r requirements.txt
```

### 3. 配置环境变量
```bash
cp .env.template .env
# 编辑 .env 文件，填入你的API密钥
```

### 4. 初始化数据库
```bash
python3 init_d1_tables.py
```

### 5. 测试系统
```bash
# 测试数据采集
python3 main.py collect

# 测试邮件推送
python3 email_sender.py

# 查看数据报告
python3 generate_report.py
```

### 6. 启动定时任务
```bash
python3 main.py scheduler start
```

## 📋 API密钥申请

### Reddit API
1. 访问 https://www.reddit.com/prefs/apps
2. 创建新应用，选择"script"类型
3. 获取 `client_id` 和 `client_secret`

### Cloudflare D1
1. 访问 https://dash.cloudflare.com/
2. 创建D1数据库
3. 获取 `API Token`、`Account ID`、`Database ID`

### Gmail邮件推送 (可选)
1. 访问 https://myaccount.google.com/apppasswords
2. 启用两步验证
3. 生成应用专用密码

## 📊 数据查看工具

```bash
# 快速数据摘要
python3 quick_report.py

# 完整分析报告
python3 generate_report.py

# 北京时间数据查看
python3 view_data_beijing.py

# 数据导出 (CSV/JSON)
python3 data_exporter.py

# 实时系统监控
python3 continuous_monitor.py
```

## 🔧 配置说明

### 采集配置
- `DAILY_TARGET_POSTS`: 每日目标采集数量 (默认200)
- `COLLECTION_HOUR`: 采集时间 (默认6点)
- `COLLECTION_TIMEZONE`: 时区 (默认Asia/Shanghai)

### 邮件配置
- `SENDER_EMAIL`: 发送邮箱
- `SENDER_PASSWORD`: Gmail应用专用密码
- 邮件将发送HTML格式的数据报告

## 📁 项目结构

```
📂 reddit-ai-crawler/
├── 🤖 核心系统
│   ├── main.py              # 系统入口
│   ├── reddit_crawler.py    # 爬虫引擎
│   ├── content_processor.py # AI内容处理
│   ├── database_manager.py  # 数据库管理
│   └── scheduler.py         # 定时调度
├── 📊 数据分析
│   ├── generate_report.py   # 报告生成
│   ├── view_data_beijing.py # 北京时间查看
│   └── data_exporter.py     # 数据导出
├── 📧 邮件推送
│   ├── email_sender.py      # 邮件发送
│   └── email_setup_guide.md # 配置指南
├── ⚙️ 配置文件
│   ├── daily_collection_config.py
│   ├── time_filter_config.py
│   └── config.py
└── 📋 文档
    ├── reddit_ai_v1.0.md    # 完整文档
    └── README.md            # 项目说明
```

## 🛠️ 技术栈

- **Python 3.8+** - 核心开发语言
- **PRAW** - Reddit API客户端
- **Cloudflare D1** - 云SQL数据库
- **NLTK/TextBlob** - 自然语言处理
- **Schedule** - 定时任务调度
- **SMTP** - 邮件发送

## 📈 监控面板

系统提供实时监控界面：

```bash
python3 continuous_monitor.py
```

监控内容：
- 📊 采集进度和成功率
- 🔍 数据质量分析  
- 📧 邮件发送状态
- 🚨 错误日志和告警

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/新功能`)
3. 提交更改 (`git commit -am '添加新功能'`)
4. 推送到分支 (`git push origin feature/新功能`)
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🆘 支持

- 📖 **完整文档**: [reddit_ai_v1.0.md](reddit_ai_v1.0.md)
- 🚀 **快速部署**: [reddit_ai_v1.0_quickstart.md](reddit_ai_v1.0_quickstart.md)
- 📧 **邮件配置**: [email_setup_guide.md](email_setup_guide.md)
- 🐛 **问题报告**: [GitHub Issues](https://github.com/your-username/reddit-ai-crawler/issues)

---

⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！
