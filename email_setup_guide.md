# 📧 邮件自动发送配置指南

## 🎯 功能说明
Reddit AI采集系统已集成邮件发送功能，每日采集完成后自动发送数据报告到你的邮箱：
- **接收邮箱**: xiaoyan.chen222@gmail.com
- **发送时机**: 每日采集完成后（约06:30北京时间）
- **报告格式**: HTML美化格式，包含统计图表

## 📋 配置步骤

### 1. 获取Gmail应用专用密码

由于Gmail的安全设置，需要生成应用专用密码：

1. **登录Google账户**: https://myaccount.google.com/
2. **开启两步验证**: 安全 → 两步验证 → 开启
3. **生成应用密码**: 
   - 安全 → 两步验证 → 应用密码
   - 选择"邮件"和设备类型
   - 生成16位应用密码（格式：xxxx xxxx xxxx xxxx）

### 2. 配置环境变量

在项目根目录的 `.env` 文件中添加：

```bash
# 邮件发送配置
SENDER_EMAIL=你的Gmail邮箱@gmail.com
SENDER_PASSWORD=生成的16位应用密码
```

**示例**:
```bash
SENDER_EMAIL=your.email@gmail.com
SENDER_PASSWORD=abcd efgh ijkl mnop
```

### 3. 推荐的发送邮箱配置

建议使用以下两种方式之一：

#### 方案A：使用你的个人Gmail（推荐）
```bash
SENDER_EMAIL=xiaoyan.chen222@gmail.com
SENDER_PASSWORD=你的应用专用密码
```

#### 方案B：创建专用系统邮箱
```bash
SENDER_EMAIL=reddit.ai.system@gmail.com  # 新建的系统邮箱
SENDER_PASSWORD=系统邮箱的应用专用密码
```

## 🧪 测试邮件配置

配置完成后，运行测试：

```bash
python3 email_sender.py
# 选择选项1：发送测试邮件
```

## 📊 邮件报告内容

每日报告将包含：

### 📈 数据概览
- 📊 采集帖子数量
- ⭐ 平均评分
- 🔥 最高评分  
- 💬 总评论数

### 🏆 热门内容
- TOP 10 热门帖子
- 包含标题、社区、评分、时间

### 🎯 统计分析
- 社区分布统计
- AI技术领域分布
- 数据质量分析

### 🎨 报告特色
- 📧 HTML美化格式
- 📱 移动设备友好
- 🕐 北京时间显示
- 🔗 支持直接点击链接

## ⚙️ 高级配置

### 自定义发送时间
如需调整邮件发送时间，修改 `scheduler.py`：

```python
# 在采集完成后延迟发送
time.sleep(300)  # 延迟5分钟发送
self.email_sender.send_daily_report()
```

### 自定义接收邮箱
修改 `email_sender.py` 中的接收邮箱：

```python
self.recipient_email = "新的接收邮箱@example.com"
```

### 邮件服务器配置
目前支持Gmail，如需使用其他邮箱服务：

```python
# 修改 email_sender.py
self.smtp_server = "smtp.其他服务商.com"
self.smtp_port = 587  # 或 465
```

## 🔧 故障排除

### 常见问题

1. **认证失败**
   ```
   ❌ 邮件发送失败: (535, '5.7.8 Username and Password not accepted')
   ```
   - 检查是否开启两步验证
   - 确认使用应用专用密码，不是登录密码
   - 检查邮箱地址是否正确

2. **连接超时**
   ```
   ❌ 邮件发送失败: [Errno 60] Operation timed out
   ```
   - 检查网络连接
   - 确认防火墙设置
   - 尝试使用VPN

3. **配置缺失**
   ```
   ❌ 邮件配置缺失，请设置 SENDER_EMAIL 和 SENDER_PASSWORD 环境变量
   ```
   - 检查 `.env` 文件是否存在
   - 确认环境变量名称正确
   - 重启程序以加载新配置

### 调试模式

启用详细日志：

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 📅 使用指南

### 手动发送报告
```bash
python3 email_sender.py
# 选择选项2：发送今日报告
```

### 检查配置状态
```bash
python3 email_sender.py  
# 选择选项3：检查邮件配置
```

### 集成自动发送
系统已自动集成，每日采集完成后会自动发送报告。

## 🔒 安全注意事项

1. **保护应用密码**: 不要将应用密码提交到版本控制
2. **定期更换**: 建议每3个月更换一次应用密码
3. **权限最小化**: 仅授予必要的邮件发送权限
4. **监控异常**: 关注邮件发送失败的日志

## 📞 技术支持

如遇问题，请检查：
1. 环境变量配置是否正确
2. Gmail应用密码是否有效
3. 网络连接是否正常
4. 查看详细错误日志

配置完成后，你将每日早上收到精美的AI数据分析报告！📊✨
