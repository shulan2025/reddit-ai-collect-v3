// 手动触发Reddit采集的测试脚本

const WORKER_URL = 'https://reddit-ai-crawler-v2.xiaoyan-chen222.workers.dev';

async function triggerCrawl() {
  console.log('🚀 开始手动触发Reddit AI采集...');
  console.log(`📍 Worker URL: ${WORKER_URL}`);
  
  try {
    // 先检查健康状态
    console.log('\n💚 检查系统健康状态...');
    const healthResponse = await fetch(`${WORKER_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ 系统健康检查通过:', JSON.stringify(healthData, null, 2));
    } else {
      console.log('⚠️ 健康检查失败:', healthResponse.status, healthResponse.statusText);
    }
    
    // 触发采集
    console.log('\n🔥 触发数据采集...');
    const crawlResponse = await fetch(`${WORKER_URL}/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (crawlResponse.ok) {
      const crawlData = await crawlResponse.json();
      console.log('🎉 采集成功触发!');
      console.log('📊 采集结果:', JSON.stringify(crawlData, null, 2));
    } else {
      const errorText = await crawlResponse.text();
      console.log('❌ 采集触发失败:', crawlResponse.status, crawlResponse.statusText);
      console.log('错误详情:', errorText);
    }
    
  } catch (error) {
    console.error('💥 请求失败:', error.message);
    
    // 如果网络问题，尝试备用方案
    console.log('\n🔄 网络问题，尝试通过Wrangler日志监控...');
    console.log('请在另一个终端运行: npx wrangler tail');
  }
}

// 执行采集
triggerCrawl();
