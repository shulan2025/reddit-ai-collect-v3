// 增量Reddit AI帖子采集脚本
// 过滤掉今天已采集的数据，只采集新的帖子

const fs = require('fs');
const path = require('path');

const REDDIT_CLIENT_ID = 'NJnkQLyA6Gie7rGvCI3zYg';
const REDDIT_CLIENT_SECRET = 'WHFMSNNZBt1gV5xC394LGhrr5LzyPQ';
const USER_AGENT = 'reddit-ai-crawler/1.0.0 (by /u/ai_researcher)';

// Cloudflare D1 API配置
const CLOUDFLARE_API_TOKEN = 'WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU';
const ACCOUNT_ID = 'e23dc8a212c55fe9210b99f24be11eb9';
const DATABASE_ID = '3d1a2cff-14ac-49e7-9bfd-b4a5606c9712';

// 29个AI相关社区
const TARGET_SUBREDDITS = [
  'MachineLearning', 'artificial', 'deeplearning', 'LocalLLaMA', 'ChatGPT',
  'OpenAI', 'computervision', 'NLP', 'MLPapers', 'StableDiffusion',
  'ArtificialInteligence', 'singularity', 'AI_Agents', 'agi', 'neuralnetworks',
  'datasets', 'voiceai', 'MediaSynthesis', 'GPT3', 'grok',
  'ClaudeAI', 'aivideo', 'IndianArtAI', 'gameai', 'GoogleGeminiAI',
  'NovelAi', 'KindroidAI', 'WritingWithAI', 'Qwen_AI'
];

class IncrementalRedditCrawler {
  constructor() {
    this.accessToken = null;
    this.existingPostIds = new Set();
    this.newPosts = [];
    this.stats = {
      totalFetched: 0,
      totalNew: 0,
      totalDuplicate: 0,
      subredditStats: {},
      errors: []
    };
    
    // D1数据库配置
    this.d1BaseUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}`;
    this.d1Headers = {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    };
  }

  async loadExistingPostIds() {
    console.log('🔍 加载数据库中已存在的帖子ID...');
    
    try {
      const response = await fetch(`${this.d1BaseUrl}/query`, {
        method: 'POST',
        headers: this.d1Headers,
        body: JSON.stringify({ 
          sql: "SELECT id FROM redditV2_posts WHERE collection_date = date('now');" 
        })
      });

      if (!response.ok) {
        throw new Error(`数据库查询失败: ${response.status}`);
      }

      const result = await response.json();
      const existingIds = result.result[0]?.results?.map(row => row.id) || [];
      
      existingIds.forEach(id => this.existingPostIds.add(id));
      console.log(`✅ 已加载 ${existingIds.length} 个当日已采集的帖子ID`);
      
      return true;
    } catch (error) {
      console.error('❌ 加载已存在帖子ID失败:', error.message);
      console.log('⚠️ 将继续执行，但可能会有重复数据');
      return false;
    }
  }

  async authenticate() {
    console.log('🔑 正在获取Reddit API访问令牌...');
    
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

      if (!response.ok) {
        throw new Error(`认证失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      console.log('✅ Reddit API认证成功');
      return true;
    } catch (error) {
      console.error('❌ Reddit API认证失败:', error.message);
      return false;
    }
  }

  async fetchSubredditPosts(subreddit, limit = 100, after = null) {
    if (!this.accessToken) {
      throw new Error('需要先进行API认证');
    }

    try {
      let url = `https://oauth.reddit.com/r/${subreddit}/hot.json?limit=${limit}&raw_json=1`;
      if (after) {
        url += `&after=${after}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'User-Agent': USER_AGENT
        }
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        posts: this.processPosts(data.data.children, subreddit),
        after: data.data.after
      };
    } catch (error) {
      console.error(`❌ 获取 r/${subreddit} 失败:`, error.message);
      this.stats.errors.push(`r/${subreddit}: ${error.message}`);
      return { posts: [], after: null };
    }
  }

  processPosts(children, subreddit) {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60); // 30天前
    
    const validPosts = [];
    let duplicateCount = 0;
    
    for (const child of children) {
      const post = child.data;
      
      // 检查是否已存在
      if (this.existingPostIds.has(post.id)) {
        duplicateCount++;
        continue;
      }
      
      // 检查是否在30天内
      if (post.created_utc < thirtyDaysAgo) {
        continue;
      }

      // 基础过滤: 净赞数>10, 评论数>5, 点赞率>0.1
      if (post.score < 10 || post.num_comments < 5 || (post.upvote_ratio && post.upvote_ratio < 0.1)) {
        continue;
      }

      // 检查是否被删除
      if (!post.author || post.author === '[deleted]' || post.title.includes('[deleted]')) {
        continue;
      }

      // 检查AI相关性 (简单关键词匹配)
      const aiKeywords = [
        'ai', 'artificial intelligence', 'machine learning', 'deep learning', 
        'neural network', 'gpt', 'llm', 'chatbot', 'openai', 'anthropic',
        'claude', 'gemini', 'stable diffusion', 'midjourney', 'transformer',
        'bert', 'nlp', 'computer vision', 'reinforcement learning', 'pytorch',
        'tensorflow', 'hugging face', 'langchain', 'rag', 'fine-tuning'
      ];

      const titleLower = post.title.toLowerCase();
      const textLower = (post.selftext || '').toLowerCase();
      const isAIRelated = aiKeywords.some(keyword => 
        titleLower.includes(keyword) || textLower.includes(keyword)
      );

      if (!isAIRelated && !TARGET_SUBREDDITS.includes(subreddit)) {
        continue; // 非AI社区的帖子必须包含AI关键词
      }

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

    return { validPosts, duplicateCount };
  }

  async crawlIncrementally(targetCount = 1000) {
    console.log('🚀 开始增量Reddit AI帖子采集...');
    console.log(`🎯 目标: 新采集${targetCount}条最近30天的AI帖子`);
    console.log(`📋 社区数量: ${TARGET_SUBREDDITS.length}`);
    console.log('');

    // 加载当日已采集的帖子ID (避免当日重复)
    await this.loadExistingPostIds();

    // 认证
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      return false;
    }

    // 计算每个社区的目标帖子数
    const postsPerSubreddit = Math.ceil(targetCount / TARGET_SUBREDDITS.length);
    console.log(`📊 平均每社区目标: ${postsPerSubreddit} 新帖子`);
    console.log('');

    let totalNewCollected = 0;

    for (let i = 0; i < TARGET_SUBREDDITS.length && totalNewCollected < targetCount; i++) {
      const subreddit = TARGET_SUBREDDITS[i];
      
      try {
        console.log(`📥 [${i+1}/${TARGET_SUBREDDITS.length}] 正在采集 r/${subreddit}...`);
        
        let subredditNewPosts = [];
        let totalDuplicates = 0;
        let after = null;
        let attempts = 0;
        const maxAttempts = 4; // 每个社区最多4次请求

        while (subredditNewPosts.length < postsPerSubreddit && attempts < maxAttempts && totalNewCollected < targetCount) {
          await new Promise(resolve => setTimeout(resolve, 1200)); // 1.2秒间隔
          
          const result = await this.fetchSubredditPosts(subreddit, 100, after);
          const { validPosts, duplicateCount } = result.posts;
          
          // 过滤掉已经在newPosts中的帖子（避免同一次采集中的重复）
          const uniqueNewPosts = validPosts.filter(post => 
            !this.newPosts.some(existing => existing.id === post.id)
          );
          
          subredditNewPosts.push(...uniqueNewPosts);
          totalDuplicates += duplicateCount;
          after = result.after;
          attempts++;

          if (!after || validPosts.length === 0) {
            break; // 没有更多帖子了
          }
        }

        // 限制每个社区的帖子数量
        const remainingSlots = targetCount - totalNewCollected;
        const postsToAdd = subredditNewPosts.slice(0, Math.min(postsPerSubreddit, remainingSlots));
        
        this.newPosts.push(...postsToAdd);
        totalNewCollected += postsToAdd.length;

        // 统计信息
        this.stats.subredditStats[subreddit] = {
          newPosts: postsToAdd.length,
          duplicates: totalDuplicates,
          attempts: attempts
        };

        console.log(`   ✅ r/${subreddit}: ${postsToAdd.length} 新帖子, ${totalDuplicates} 重复 (总计新帖子: ${totalNewCollected})`);

      } catch (error) {
        console.error(`❌ 处理 r/${subreddit} 时出错:`, error.message);
        this.stats.errors.push(`r/${subreddit}: ${error.message}`);
      }

      // 进度更新
      if ((i + 1) % 5 === 0) {
        console.log(`🔄 进度更新: ${totalNewCollected}/${targetCount} 新帖子已采集 (${Math.round(totalNewCollected/targetCount*100)}%)`);
      }
    }

    this.stats.totalNew = this.newPosts.length;
    this.stats.totalDuplicate = Object.values(this.stats.subredditStats).reduce((sum, stat) => sum + stat.duplicates, 0);

    return true;
  }

  async insertNewPosts() {
    if (this.newPosts.length === 0) {
      console.log('📭 没有新帖子需要插入');
      return { successCount: 0, errorCount: 0 };
    }

    console.log(`📥 准备插入${this.newPosts.length}条新帖子到D1数据库...`);
    
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 50; // 每批50条记录

    for (let i = 0; i < this.newPosts.length; i += batchSize) {
      const batch = this.newPosts.slice(i, i + batchSize);
      console.log(`   正在处理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(this.newPosts.length/batchSize)} (${batch.length} 条记录)...`);

      try {
        // 构建批量插入SQL
        let sql = 'INSERT OR REPLACE INTO redditV2_posts (id, subreddit, title, selftext, url, post_url, created_utc, collected_at, collection_date, collection_batch_id, author, score, num_comments, upvote_ratio, ups, downs, flair, awards, is_self, is_video, ai_relevance_score, is_ai_related) VALUES ';
        
        const values = batch.map(post => {
          const escapedTitle = post.title.replace(/'/g, "''").substring(0, 500);
          const escapedSelftext = post.selftext ? post.selftext.replace(/'/g, "''").substring(0, 5000) : null;
          const escapedFlair = post.flair ? post.flair.replace(/'/g, "''") : null;
          
          return `('${post.id}', '${post.subreddit}', '${escapedTitle}', ${escapedSelftext ? `'${escapedSelftext}'` : 'NULL'}, '${post.url}', '${post.post_url}', ${post.created_utc}, ${post.collected_at}, '${post.collection_date}', 'incremental_${Date.now()}', '${post.author}', ${post.score}, ${post.num_comments}, ${post.upvote_ratio}, ${post.ups}, ${post.downs}, ${escapedFlair ? `'${escapedFlair}'` : 'NULL'}, NULL, ${post.is_self ? 1 : 0}, ${post.is_video ? 1 : 0}, ${post.ai_relevance_score}, ${post.is_ai_related ? 1 : 0})`;
        });

        sql += values.join(', ') + ';';

        const response = await fetch(`${this.d1BaseUrl}/query`, {
          method: 'POST',
          headers: this.d1Headers,
          body: JSON.stringify({ sql })
        });

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status}`);
        }

        successCount += batch.length;
        console.log(`   ✅ 批次完成: ${batch.length} 条记录已插入`);

        // 添加延迟避免API限制
        await new Promise(resolve => setTimeout(resolve, 600));

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

  async saveResults() {
    if (this.newPosts.length === 0) {
      console.log('📭 没有新数据需要保存');
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dataDir = path.join(__dirname, '..', 'data');
    
    // 确保数据目录存在
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 保存新帖子数据
    const postsFile = path.join(dataDir, `reddit-posts-incremental-${timestamp}.json`);
    fs.writeFileSync(postsFile, JSON.stringify(this.newPosts, null, 2));

    // 保存统计数据
    const statsFile = path.join(dataDir, `crawl-stats-incremental-${timestamp}.json`);
    fs.writeFileSync(statsFile, JSON.stringify(this.stats, null, 2));

    console.log('');
    console.log('💾 增量数据保存完成:');
    console.log(`   📄 新帖子数据: ${postsFile}`);
    console.log(`   📊 统计数据: ${statsFile}`);

    return { postsFile, statsFile };
  }

  printSummary() {
    console.log('');
    console.log('📋 增量采集完成总结:');
    console.log('=====================================');
    console.log(`📊 新采集帖子: ${this.stats.totalNew}`);
    console.log(`🔄 跳过重复: ${this.stats.totalDuplicate}`);
    console.log(`📈 新增比例: ${this.stats.totalDuplicate > 0 ? Math.round(this.stats.totalNew/(this.stats.totalNew + this.stats.totalDuplicate)*100) : 100}%`);
    
    if (this.newPosts.length > 0) {
      // 时间分布
      const timeRanges = { '1天内': 0, '1-7天': 0, '7-14天': 0, '14-30天': 0 };
      this.newPosts.forEach(post => {
        if (post.post_age_days <= 1) timeRanges['1天内']++;
        else if (post.post_age_days <= 7) timeRanges['1-7天']++;
        else if (post.post_age_days <= 14) timeRanges['7-14天']++;
        else timeRanges['14-30天']++;
      });

      console.log('');
      console.log('📈 新帖子时间分布:');
      Object.entries(timeRanges).forEach(([range, count]) => {
        console.log(`   ${range}: ${count} 帖子 (${Math.round(count/this.newPosts.length*100)}%)`);
      });

      // 社区贡献 (Top 10)
      const subredditCounts = {};
      this.newPosts.forEach(post => {
        subredditCounts[post.subreddit] = (subredditCounts[post.subreddit] || 0) + 1;
      });

      console.log('');
      console.log('🏆 新帖子社区贡献 Top 10:');
      Object.entries(subredditCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([subreddit, count], index) => {
          console.log(`   ${index + 1}. r/${subreddit}: ${count} 新帖子`);
        });

      // 质量统计
      const avgScore = Math.round(this.newPosts.reduce((sum, post) => sum + post.score, 0) / this.newPosts.length);
      const avgComments = Math.round(this.newPosts.reduce((sum, post) => sum + post.num_comments, 0) / this.newPosts.length);
      const avgRatio = (this.newPosts.reduce((sum, post) => sum + post.upvote_ratio, 0) / this.newPosts.length).toFixed(2);

      console.log('');
      console.log('⭐ 新帖子质量统计:');
      console.log(`   平均分数: ${avgScore}`);
      console.log(`   平均评论: ${avgComments}`);
      console.log(`   平均点赞率: ${avgRatio}`);
    }

    if (this.stats.errors.length > 0) {
      console.log('');
      console.log('⚠️ 错误记录:');
      this.stats.errors.forEach(error => console.log(`   ${error}`));
    }

    console.log('');
    console.log('✅ 增量Reddit AI帖子采集任务完成! 🎉');
  }
}

// 执行增量采集
async function main() {
  const crawler = new IncrementalRedditCrawler();
  
  try {
    const success = await crawler.crawlIncrementally(1000);
    if (success) {
      const insertResult = await crawler.insertNewPosts();
      if (insertResult.successCount > 0) {
        await crawler.saveResults();
      }
      crawler.printSummary();
    }
  } catch (error) {
    console.error('❌ 增量采集过程中出现错误:', error);
  }
}

main().catch(console.error);
