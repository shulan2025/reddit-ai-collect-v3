// 直接使用Cloudflare API token操作D1数据库的脚本
const fs = require('fs');
const path = require('path');

const CLOUDFLARE_API_TOKEN = 'WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU';
const ACCOUNT_ID = 'e23dc8a212c55fe9210b99f24be11eb9';
const DATABASE_ID = '3d1a2cff-14ac-49e7-9bfd-b4a5606c9712';

class DirectD1Manager {
  constructor() {
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}`;
    this.headers = {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    };
  }

  async executeQuery(sql) {
    try {
      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ sql })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ 数据库查询失败:', error.message);
      throw error;
    }
  }

  async testConnection() {
    console.log('🔍 测试D1数据库连接...');
    try {
      const result = await this.executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'redditV2_%';");
      console.log('✅ 数据库连接成功!');
      console.log('📋 现有表:', result.result[0]?.results?.map(row => row.name) || []);
      return true;
    } catch (error) {
      console.error('❌ 数据库连接失败:', error.message);
      return false;
    }
  }

  async insertPosts(posts) {
    console.log(`📥 准备插入${posts.length}条帖子到D1数据库...`);
    
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 50; // 每批50条记录

    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      console.log(`   正在处理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(posts.length/batchSize)} (${batch.length} 条记录)...`);

      try {
        // 构建批量插入SQL
        let sql = 'INSERT OR REPLACE INTO redditV2_posts (id, subreddit, title, selftext, url, created_utc, collected_at, collection_date, collection_batch_id, author, score, num_comments, upvote_ratio, ups, downs, flair, awards, is_self, is_video, ai_relevance_score, is_ai_related) VALUES ';
        
        const values = batch.map(post => {
          const escapedTitle = post.title.replace(/'/g, "''").substring(0, 500);
          const escapedSelftext = post.selftext ? post.selftext.replace(/'/g, "''").substring(0, 5000) : null;
          const escapedFlair = post.flair ? post.flair.replace(/'/g, "''") : null;
          
          return `('${post.id}', '${post.subreddit}', '${escapedTitle}', ${escapedSelftext ? `'${escapedSelftext}'` : 'NULL'}, '${post.url}', ${post.created_utc}, ${post.collected_at}, '${post.collection_date}', '${post.collection_batch_id || 'batch_' + Date.now()}', '${post.author}', ${post.score}, ${post.num_comments}, ${post.upvote_ratio}, ${post.ups}, ${post.downs}, ${escapedFlair ? `'${escapedFlair}'` : 'NULL'}, NULL, ${post.is_self ? 1 : 0}, ${post.is_video ? 1 : 0}, ${post.ai_relevance_score}, ${post.is_ai_related ? 1 : 0})`;
        });

        sql += values.join(', ') + ';';

        await this.executeQuery(sql);
        successCount += batch.length;
        console.log(`   ✅ 批次完成: ${batch.length} 条记录已插入`);

        // 添加延迟避免API限制
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`   ❌ 批次失败:`, error.message);
        errorCount += batch.length;
      }
    }

    console.log('');
    console.log('📊 插入结果:');
    console.log(`   ✅ 成功: ${successCount} 条`);
    console.log(`   ❌ 失败: ${errorCount} 条`);
    console.log(`   📈 成功率: ${Math.round(successCount/(successCount + errorCount)*100)}%`);

    return { successCount, errorCount };
  }

  async getStats() {
    try {
      const result = await this.executeQuery(`
        SELECT 
          COUNT(*) as total_posts,
          COUNT(DISTINCT subreddit) as unique_subreddits,
          AVG(score) as avg_score,
          AVG(num_comments) as avg_comments,
          MIN(datetime(created_utc, 'unixepoch')) as oldest_post,
          MAX(datetime(created_utc, 'unixepoch')) as newest_post
        FROM redditV2_posts;
      `);

      const stats = result.result[0]?.results?.[0];
      if (stats) {
        console.log('📊 数据库统计:');
        console.log(`   📄 总帖子数: ${stats.total_posts}`);
        console.log(`   🏠 社区数: ${stats.unique_subreddits}`);
        console.log(`   ⭐ 平均分数: ${Math.round(stats.avg_score)}`);
        console.log(`   💬 平均评论: ${Math.round(stats.avg_comments)}`);
        console.log(`   📅 最老帖子: ${stats.oldest_post}`);
        console.log(`   📅 最新帖子: ${stats.newest_post}`);
      }

      return stats;
    } catch (error) {
      console.error('获取统计信息失败:', error.message);
      return null;
    }
  }
}

async function loadLatestCrawlData() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    console.log('❌ 数据目录不存在，请先运行采集脚本');
    return null;
  }

  // 查找最新的帖子数据文件
  const files = fs.readdirSync(dataDir)
    .filter(file => file.startsWith('reddit-posts-') && file.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('❌ 未找到采集数据文件，请先运行采集脚本');
    return null;
  }

  const latestFile = path.join(dataDir, files[0]);
  console.log(`📂 加载数据文件: ${files[0]}`);
  
  try {
    const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    console.log(`✅ 成功加载 ${data.length} 条帖子数据`);
    return data;
  } catch (error) {
    console.error('❌ 读取数据文件失败:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 直接D1数据库操作脚本启动...');
  console.log('');

  const d1Manager = new DirectD1Manager();

  // 测试连接
  const connected = await d1Manager.testConnection();
  if (!connected) {
    console.log('❌ 无法连接到D1数据库，请检查token和配置');
    return;
  }

  // 加载采集数据
  const posts = await loadLatestCrawlData();
  if (!posts || posts.length === 0) {
    console.log('❌ 没有可插入的数据');
    return;
  }

  console.log('');
  console.log('📥 开始插入数据到D1数据库...');
  
  // 插入数据
  const result = await d1Manager.insertPosts(posts);
  
  if (result.successCount > 0) {
    console.log('');
    console.log('📊 插入完成，获取数据库统计...');
    await d1Manager.getStats();
  }

  console.log('');
  console.log('✅ 直接D1操作完成! 🎉');
}

main().catch(console.error);
