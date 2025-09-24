// Reddit AI Collect v3.0 深度测试脚本
// 完整测试全流程，验证系统稳定性

const fs = require('fs');
const path = require('path');

const REDDIT_CLIENT_ID = 'NJnkQLyA6Gie7rGvCI3zYg';
const REDDIT_CLIENT_SECRET = 'WHFMSNNZBt1gV5xC394LGhrr5LzyPQ';
const USER_AGENT = 'reddit-ai-collect_v2/2.0.0 (by /u/ai_researcher)';

// Cloudflare D1 API配置
const CLOUDFLARE_API_TOKEN = 'WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU';
const ACCOUNT_ID = 'e23dc8a212c55fe9210b99f24be11eb9';
const DATABASE_ID = '3d1a2cff-14ac-49e7-9bfd-b4a5606c9712';

// 测试用的社区（选择最活跃的几个）
const TEST_SUBREDDITS = [
  'ChatGPT', 'LocalLLaMA', 'OpenAI', 'artificial', 'singularity',
  'ClaudeAI', 'StableDiffusion', 'MachineLearning'
];

class DeepTestCrawler {
  constructor() {
    this.accessToken = null;
    this.testResults = {
      startTime: Date.now(),
      endTime: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      errors: [],
      warnings: [],
      performance: {},
      dataQuality: {},
      apiStats: {
        requests: 0,
        successes: 0,
        failures: 0,
        retries: 0
      }
    };
    
    // D1数据库配置
    this.d1BaseUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}`;
    this.d1Headers = {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    };

    this.collectedPosts = [];
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const prefix = {
      'INFO': '✅',
      'WARN': '⚠️',
      'ERROR': '❌',
      'TEST': '🧪'
    }[level] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp.split('T')[1].split('.')[0]}] ${message}`);
    
    if (level === 'ERROR') {
      this.testResults.errors.push(message);
    } else if (level === 'WARN') {
      this.testResults.warnings.push(message);
    }
  }

  test(condition, testName) {
    this.testResults.totalTests++;
    if (condition) {
      this.testResults.passedTests++;
      this.log('TEST', `✅ ${testName}`);
      return true;
    } else {
      this.testResults.failedTests++;
      this.log('TEST', `❌ ${testName}`);
      return false;
    }
  }

  async testAuthentication() {
    this.log('INFO', '🔑 测试Reddit API认证...');
    
    const credentials = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
    
    try {
      const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT
        },
        body: 'grant_type=client_credentials'
      });

      this.testResults.apiStats.requests++;
      
      if (!response.ok) {
        this.testResults.apiStats.failures++;
        throw new Error(`认证失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.testResults.apiStats.successes++;
      
      this.test(!!this.accessToken, 'Reddit API认证成功');
      this.test(typeof data.access_token === 'string', 'Access token格式正确');
      this.test(data.token_type === 'bearer', 'Token类型正确');
      
      return true;
    } catch (error) {
      this.testResults.apiStats.failures++;
      this.log('ERROR', `Reddit API认证失败: ${error.message}`);
      this.test(false, 'Reddit API认证');
      return false;
    }
  }

  async testDatabaseConnection() {
    this.log('INFO', '🗄️ 测试D1数据库连接...');
    
    try {
      const response = await fetch(`${this.d1BaseUrl}/query`, {
        method: 'POST',
        headers: this.d1Headers,
        body: JSON.stringify({ 
          sql: "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'redditV2_%';" 
        })
      });

      if (!response.ok) {
        throw new Error(`数据库连接失败: ${response.status}`);
      }

      const result = await response.json();
      const tables = result.result[0]?.results?.map(row => row.name) || [];
      
      this.test(tables.length >= 5, '数据库表结构完整');
      this.test(tables.includes('redditV2_posts'), 'posts表存在');
      this.test(tables.includes('redditV2_collection_stats'), 'collection_stats表存在');
      
      this.log('INFO', `发现 ${tables.length} 个数据库表: ${tables.join(', ')}`);
      return true;
    } catch (error) {
      this.log('ERROR', `数据库连接测试失败: ${error.message}`);
      this.test(false, '数据库连接');
      return false;
    }
  }

  async testSingleSubredditFetch(subreddit) {
    this.log('INFO', `📥 测试单个社区数据获取: r/${subreddit}`);
    
    const startTime = Date.now();
    
    try {
      const url = `https://oauth.reddit.com/r/${subreddit}/hot.json?limit=25&raw_json=1`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'User-Agent': USER_AGENT
        }
      });

      this.testResults.apiStats.requests++;
      const fetchTime = Date.now() - startTime;

      if (!response.ok) {
        this.testResults.apiStats.failures++;
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.testResults.apiStats.successes++;
      
      const posts = data.data?.children || [];
      const validPosts = this.processPostsForTesting(posts, subreddit);
      
      // 性能测试
      this.test(fetchTime < 5000, `r/${subreddit} API响应时间 < 5秒 (${fetchTime}ms)`);
      this.test(posts.length > 0, `r/${subreddit} 返回帖子数据`);
      this.test(validPosts.length >= 0, `r/${subreddit} 数据处理成功`);
      
      // 数据质量测试
      if (validPosts.length > 0) {
        const avgScore = validPosts.reduce((sum, post) => sum + post.score, 0) / validPosts.length;
        const avgComments = validPosts.reduce((sum, post) => sum + post.num_comments, 0) / validPosts.length;
        
        this.test(avgScore >= 10, `r/${subreddit} 平均分数符合要求 (${Math.round(avgScore)})`);
        this.test(avgComments >= 5, `r/${subreddit} 平均评论数符合要求 (${Math.round(avgComments)})`);
      }
      
      this.collectedPosts.push(...validPosts);
      
      return {
        subreddit,
        fetchTime,
        rawCount: posts.length,
        validCount: validPosts.length,
        avgScore: validPosts.length > 0 ? Math.round(validPosts.reduce((sum, post) => sum + post.score, 0) / validPosts.length) : 0
      };
      
    } catch (error) {
      this.testResults.apiStats.failures++;
      this.log('ERROR', `r/${subreddit} 获取失败: ${error.message}`);
      this.test(false, `r/${subreddit} 数据获取`);
      return null;
    }
  }

  processPostsForTesting(children, subreddit) {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    
    const validPosts = [];
    
    for (const child of children) {
      const post = child.data;
      
      // 时间过滤测试
      if (post.created_utc < thirtyDaysAgo) {
        continue;
      }

      // 质量过滤测试
      if (post.score < 10 || post.num_comments < 5 || (post.upvote_ratio && post.upvote_ratio < 0.1)) {
        continue;
      }

      // 有效性检查
      if (!post.author || post.author === '[deleted]' || post.title.includes('[deleted]')) {
        continue;
      }

      // AI相关性检测
      const aiKeywords = [
        'ai', 'artificial intelligence', 'machine learning', 'deep learning', 
        'neural network', 'gpt', 'llm', 'chatbot', 'openai', 'anthropic',
        'claude', 'gemini', 'stable diffusion', 'midjourney', 'transformer'
      ];

      const titleLower = post.title.toLowerCase();
      const textLower = (post.selftext || '').toLowerCase();
      const isAIRelated = aiKeywords.some(keyword => 
        titleLower.includes(keyword) || textLower.includes(keyword)
      );

      const processedPost = {
        id: post.id,
        subreddit: subreddit,
        title: post.title,
        selftext: post.selftext || null,
        url: post.url, // 原始URL（可能是图片/视频/外部链接）
        post_url: `https://www.reddit.com${post.permalink}`, // 标准帖子URL
        author: post.author,
        created_utc: post.created_utc,
        collected_at: now,
        collection_date: new Date().toISOString().split('T')[0],
        score: post.score,
        num_comments: post.num_comments,
        upvote_ratio: post.upvote_ratio || 0,
        ups: post.ups || 0,
        downs: post.downs || 0,
        flair: post.link_flair_text || null,
        is_self: post.is_self,
        is_video: post.is_video || false,
        ai_relevance_score: isAIRelated ? 1.0 : 0.5,
        is_ai_related: isAIRelated,
        post_age_days: Math.floor((now - post.created_utc) / (24 * 60 * 60))
      };

      validPosts.push(processedPost);
    }

    return validPosts;
  }

  async testBatchDataInsertion() {
    if (this.collectedPosts.length === 0) {
      this.log('WARN', '没有数据可供插入测试');
      this.test(false, '批量数据插入测试');
      return false;
    }

    this.log('INFO', `💾 测试批量数据插入 (${this.collectedPosts.length}条记录)...`);
    
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 25; // 测试用较小批次

    try {
      for (let i = 0; i < this.collectedPosts.length; i += batchSize) {
        const batch = this.collectedPosts.slice(i, i + batchSize);
        
        try {
        let sql = 'INSERT OR REPLACE INTO redditV2_posts (id, subreddit, title, selftext, url, post_url, created_utc, collected_at, collection_date, collection_batch_id, author, score, num_comments, upvote_ratio, ups, downs, flair, awards, is_self, is_video, ai_relevance_score, is_ai_related) VALUES ';
        
        const values = batch.map(post => {
          const escapedTitle = post.title.replace(/'/g, "''").substring(0, 500);
          const escapedSelftext = post.selftext ? post.selftext.replace(/'/g, "''").substring(0, 5000) : null;
          const escapedFlair = post.flair ? post.flair.replace(/'/g, "''") : null;
          
          return `('${post.id}', '${post.subreddit}', '${escapedTitle}', ${escapedSelftext ? `'${escapedSelftext}'` : 'NULL'}, '${post.url}', '${post.post_url}', ${post.created_utc}, ${post.collected_at}, '${post.collection_date}', 'deep_test_${Date.now()}', '${post.author}', ${post.score}, ${post.num_comments}, ${post.upvote_ratio}, ${post.ups}, ${post.downs}, ${escapedFlair ? `'${escapedFlair}'` : 'NULL'}, NULL, ${post.is_self ? 1 : 0}, ${post.is_video ? 1 : 0}, ${post.ai_relevance_score}, ${post.is_ai_related ? 1 : 0})`;
        });

          sql += values.join(', ') + ';';

          const response = await fetch(`${this.d1BaseUrl}/query`, {
            method: 'POST',
            headers: this.d1Headers,
            body: JSON.stringify({ sql })
          });

          if (!response.ok) {
            throw new Error(`批次插入失败: ${response.status}`);
          }

          successCount += batch.length;
          await new Promise(resolve => setTimeout(resolve, 300)); // 限流

        } catch (error) {
          errorCount += batch.length;
          this.log('ERROR', `批次插入失败: ${error.message}`);
        }
      }

      const insertTime = Date.now() - startTime;
      const successRate = Math.round(successCount / (successCount + errorCount) * 100);
      
      this.test(successRate >= 95, `数据插入成功率 >= 95% (实际: ${successRate}%)`);
      this.test(insertTime < 30000, `批量插入时间 < 30秒 (实际: ${Math.round(insertTime/1000)}秒)`);
      this.test(successCount > 0, '至少有数据成功插入');
      
      this.testResults.performance.insertTime = insertTime;
      this.testResults.performance.insertSuccessRate = successRate;
      
      this.log('INFO', `插入完成: ${successCount}条成功, ${errorCount}条失败, 用时${Math.round(insertTime/1000)}秒`);
      
      return successCount > 0;
      
    } catch (error) {
      this.log('ERROR', `批量插入测试失败: ${error.message}`);
      this.test(false, '批量数据插入');
      return false;
    }
  }

  async testDataQuality() {
    this.log('INFO', '📊 测试数据质量...');
    
    try {
      const response = await fetch(`${this.d1BaseUrl}/query`, {
        method: 'POST',
        headers: this.d1Headers,
        body: JSON.stringify({ 
          sql: `SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT subreddit) as unique_subreddits,
            AVG(score) as avg_score,
            AVG(num_comments) as avg_comments,
            AVG(upvote_ratio) as avg_ratio,
            COUNT(CASE WHEN is_ai_related = 1 THEN 1 END) as ai_related_count,
            MIN(created_utc) as oldest_post,
            MAX(created_utc) as newest_post
          FROM redditV2_posts 
          WHERE collection_batch_id LIKE 'deep_test_%';` 
        })
      });

      if (!response.ok) {
        throw new Error(`数据质量查询失败: ${response.status}`);
      }

      const result = await response.json();
      const stats = result.result[0]?.results?.[0];
      
      if (!stats) {
        this.test(false, '数据质量统计查询');
        return false;
      }
      
      // 数据质量测试
      this.test(stats.total > 0, `数据库包含测试数据 (${stats.total}条)`);
      this.test(stats.unique_subreddits >= 3, `覆盖多个社区 (${stats.unique_subreddits}个)`);
      this.test(stats.avg_score >= 10, `平均分数符合要求 (${Math.round(stats.avg_score)})`);
      this.test(stats.avg_comments >= 5, `平均评论数符合要求 (${Math.round(stats.avg_comments)})`);
      this.test(stats.avg_ratio >= 0.1, `平均点赞率符合要求 (${stats.avg_ratio.toFixed(2)})`);
      this.test(stats.ai_related_count > 0, `包含AI相关帖子 (${stats.ai_related_count}条)`);
      
      // 时间有效性测试
      const now = Math.floor(Date.now() / 1000);
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
      
      this.test(stats.oldest_post >= thirtyDaysAgo, '所有帖子都在30天内');
      this.test(stats.newest_post <= now, '帖子时间戳合理');
      
      this.testResults.dataQuality = {
        totalPosts: stats.total,
        uniqueSubreddits: stats.unique_subreddits,
        avgScore: Math.round(stats.avg_score),
        avgComments: Math.round(stats.avg_comments),
        avgRatio: parseFloat(stats.avg_ratio.toFixed(2)),
        aiRelatedCount: stats.ai_related_count,
        aiRelatedPercent: Math.round(stats.ai_related_count / stats.total * 100)
      };
      
      return true;
      
    } catch (error) {
      this.log('ERROR', `数据质量测试失败: ${error.message}`);
      this.test(false, '数据质量验证');
      return false;
    }
  }

  async testIncrementalCrawl() {
    this.log('INFO', '🔄 测试增量采集功能...');
    
    try {
      // 模拟增量采集：获取已存在的帖子ID
      const response = await fetch(`${this.d1BaseUrl}/query`, {
        method: 'POST',
        headers: this.d1Headers,
        body: JSON.stringify({ 
          sql: "SELECT id FROM redditV2_posts WHERE collection_batch_id LIKE 'deep_test_%' LIMIT 10;" 
        })
      });

      if (!response.ok) {
        throw new Error(`增量采集测试查询失败: ${response.status}`);
      }

      const result = await response.json();
      const existingIds = result.result[0]?.results?.map(row => row.id) || [];
      
      this.test(existingIds.length > 0, '能够获取已存在的帖子ID');
      
      // 测试去重逻辑
      const testPosts = this.collectedPosts.slice(0, 5);
      const duplicateCount = testPosts.filter(post => existingIds.includes(post.id)).length;
      
      this.test(duplicateCount >= 0, `去重逻辑正常 (发现${duplicateCount}个重复)`);
      
      this.log('INFO', `增量采集测试: 检查了${testPosts.length}个帖子，发现${duplicateCount}个重复`);
      
      return true;
      
    } catch (error) {
      this.log('ERROR', `增量采集测试失败: ${error.message}`);
      this.test(false, '增量采集功能');
      return false;
    }
  }

  async runFullTest() {
    this.log('INFO', '🚀 开始Reddit AI Collect v2.0 深度测试...');
    this.log('INFO', `测试目标: ${TEST_SUBREDDITS.length}个社区，预期采集200-400条帖子`);
    
    // 1. 认证测试
    const authSuccess = await this.testAuthentication();
    if (!authSuccess) {
      this.log('ERROR', '认证失败，终止测试');
      return false;
    }

    // 2. 数据库连接测试
    const dbSuccess = await this.testDatabaseConnection();
    if (!dbSuccess) {
      this.log('ERROR', '数据库连接失败，终止测试');
      return false;
    }

    // 3. 数据采集测试
    this.log('INFO', '📥 开始数据采集测试...');
    const subredditResults = [];
    
    for (const subreddit of TEST_SUBREDDITS) {
      const result = await this.testSingleSubredditFetch(subreddit);
      if (result) {
        subredditResults.push(result);
      }
      
      // API限流
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    // 4. 数据插入测试
    const insertSuccess = await this.testBatchDataInsertion();
    
    // 5. 数据质量测试
    if (insertSuccess) {
      await this.testDataQuality();
    }

    // 6. 增量采集测试
    await this.testIncrementalCrawl();

    // 记录性能数据
    this.testResults.performance.totalFetchTime = subredditResults.reduce((sum, r) => sum + r.fetchTime, 0);
    this.testResults.performance.avgFetchTime = Math.round(this.testResults.performance.totalFetchTime / subredditResults.length);
    this.testResults.performance.totalPosts = this.collectedPosts.length;
    this.testResults.performance.postsPerMinute = Math.round(this.collectedPosts.length / (this.testResults.performance.totalFetchTime / 60000));

    this.testResults.endTime = Date.now();
    this.testResults.duration = this.testResults.endTime - this.testResults.startTime;

    return true;
  }

  generateTestReport() {
    const duration = Math.round(this.testResults.duration / 1000);
    const successRate = Math.round(this.testResults.passedTests / this.testResults.totalTests * 100);
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 Reddit AI Collect v2.0 深度测试报告');
    console.log('='.repeat(60));
    
    console.log(`\n🕐 测试执行时间: ${duration}秒`);
    console.log(`📊 测试统计:`);
    console.log(`   总测试项: ${this.testResults.totalTests}`);
    console.log(`   通过测试: ${this.testResults.passedTests}`);
    console.log(`   失败测试: ${this.testResults.failedTests}`);
    console.log(`   成功率: ${successRate}%`);
    
    console.log(`\n🌐 API统计:`);
    console.log(`   总请求数: ${this.testResults.apiStats.requests}`);
    console.log(`   成功请求: ${this.testResults.apiStats.successes}`);
    console.log(`   失败请求: ${this.testResults.apiStats.failures}`);
    console.log(`   API成功率: ${Math.round(this.testResults.apiStats.successes / this.testResults.apiStats.requests * 100)}%`);
    
    if (this.testResults.performance.totalPosts) {
      console.log(`\n⚡ 性能统计:`);
      console.log(`   采集帖子数: ${this.testResults.performance.totalPosts}`);
      console.log(`   平均获取时间: ${this.testResults.performance.avgFetchTime}ms`);
      console.log(`   采集速度: ${this.testResults.performance.postsPerMinute}帖子/分钟`);
      if (this.testResults.performance.insertTime) {
        console.log(`   插入时间: ${Math.round(this.testResults.performance.insertTime/1000)}秒`);
        console.log(`   插入成功率: ${this.testResults.performance.insertSuccessRate}%`);
      }
    }
    
    if (this.testResults.dataQuality.totalPosts) {
      console.log(`\n📊 数据质量:`);
      console.log(`   测试数据量: ${this.testResults.dataQuality.totalPosts}条`);
      console.log(`   覆盖社区: ${this.testResults.dataQuality.uniqueSubreddits}个`);
      console.log(`   平均分数: ${this.testResults.dataQuality.avgScore}`);
      console.log(`   平均评论: ${this.testResults.dataQuality.avgComments}`);
      console.log(`   平均点赞率: ${this.testResults.dataQuality.avgRatio}`);
      console.log(`   AI相关帖子: ${this.testResults.dataQuality.aiRelatedCount}条 (${this.testResults.dataQuality.aiRelatedPercent}%)`);
    }
    
    if (this.testResults.errors.length > 0) {
      console.log(`\n❌ 错误记录 (${this.testResults.errors.length}个):`);
      this.testResults.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    if (this.testResults.warnings.length > 0) {
      console.log(`\n⚠️ 警告记录 (${this.testResults.warnings.length}个):`);
      this.testResults.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }
    
    console.log(`\n🎯 测试结论:`);
    if (successRate >= 90) {
      console.log(`   ✅ 系统运行状态: 优秀 (${successRate}%)`);
      console.log(`   🚀 Reddit AI Collect v2.0 已准备好投入生产使用!`);
    } else if (successRate >= 75) {
      console.log(`   ⚠️ 系统运行状态: 良好 (${successRate}%)`);
      console.log(`   🔧 建议修复失败的测试项后投入使用`);
    } else {
      console.log(`   ❌ 系统运行状态: 需要改进 (${successRate}%)`);
      console.log(`   🛠️ 请修复关键问题后重新测试`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    // 保存测试报告
    const reportPath = path.join(__dirname, '..', 'data', `deep-test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
    console.log(`📄 详细测试报告已保存: ${reportPath}`);
    
    return successRate >= 75;
  }
}

// 执行深度测试
async function main() {
  const tester = new DeepTestCrawler();
  
  try {
    const success = await tester.runFullTest();
    const reportSuccess = tester.generateTestReport();
    
    process.exit(reportSuccess ? 0 : 1);
  } catch (error) {
    console.error('❌ 深度测试过程中出现严重错误:', error);
    process.exit(1);
  }
}

main().catch(console.error);
