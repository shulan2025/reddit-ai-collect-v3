#!/usr/bin/env node

/**
 * 增强版增量Reddit AI帖子采集脚本
 * 优化过滤条件以提高采集数量
 */

const fs = require('fs');
const path = require('path');

// 配置参数
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || 'NJnkQLyA6Gie7rGvCI3zYg';
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || 'WHFMSNNZBt1gV5xC394LGhrr5LzyPQ';
const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || 'reddit-ai-collect_v3/3.0.0 (by /u/ai_researcher)';

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU';
const ACCOUNT_ID = process.env.ACCOUNT_ID || 'e23dc8a212c55fe9210b99f24be11eb9';
const DATABASE_ID = process.env.DATABASE_ID || '3d1a2cff-14ac-49e7-9bfd-b4a5606c9712';

// 扩展的社区列表
const TARGET_SUBREDDITS = [
  // Tier 1 - 高质量社区
  'MachineLearning', 'artificial', 'deeplearning', 'LocalLLaMA', 'ChatGPT',
  'OpenAI', 'computervision', 'NLP', 'MLPapers', 'StableDiffusion',
  
  // Tier 2 - 活跃社区
  'ArtificialInteligence', 'singularity', 'AI_Agents', 'agi', 'neuralnetworks',
  'ClaudeAI', 'aivideo', 'GoogleGeminiAI', 'NovelAi', 'KindroidAI',
  
  // Tier 3 - 补充社区
  'datasets', 'voiceai', 'MediaSynthesis', 'GPT3', 'grok',
  'IndianArtAI', 'gameai', 'WritingWithAI', 'Qwen_AI'
];

class EnhancedIncrementalCrawler {
  constructor() {
    this.accessToken = null;
    this.existingPostIds = new Set();
    this.newPosts = [];
    this.stats = {
      totalFetched: 0,
      timeFiltered: 0,
      qualityFiltered: 0,
      aiFiltered: 0,
      duplicateFiltered: 0,
      finalSaved: 0
    };

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
    try {
      const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': REDDIT_USER_AGENT
        },
        body: 'grant_type=client_credentials'
      });

      const data = await response.json();
      this.accessToken = data.access_token;
      
      if (this.accessToken) {
        console.log('✅ Reddit API认证成功');
        return true;
      } else {
        console.error('❌ 认证失败:', data);
        return false;
      }
    } catch (error) {
      console.error('❌ 认证过程失败:', error.message);
      return false;
    }
  }

  async fetchSubredditPosts(subreddit, limit = 100, after = null) {
    let url = `https://oauth.reddit.com/r/${subreddit}/hot?limit=${limit}`;
    if (after) {
      url += `&after=${after}`;
    }

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'User-Agent': REDDIT_USER_AGENT
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const children = data.data.children || [];
      const after_token = data.data.after;

      const { validPosts, duplicateCount } = this.processPosts(children, subreddit);
      this.stats.totalFetched += children.length;

      return {
        posts: { validPosts, duplicateCount },
        after: after_token,
        hasMore: !!after_token && children.length > 0
      };

    } catch (error) {
      console.error(`❌ 获取 r/${subreddit} 失败:`, error.message);
      return { posts: { validPosts: [], duplicateCount: 0 }, after: null, hasMore: false };
    }
  }

  processPosts(children, subreddit) {
    const now = Math.floor(Date.now() / 1000);
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60); // 扩大到60天
    
    const validPosts = [];
    let duplicateCount = 0;
    
    for (const child of children) {
      const post = child.data;
      
      // 检查是否已存在
      if (this.existingPostIds.has(post.id)) {
        duplicateCount++;
        this.stats.duplicateFiltered++;
        continue;
      }
      
      // 检查是否在60天内 (扩大时间范围)
      if (post.created_utc < sixtyDaysAgo) {
        this.stats.timeFiltered++;
        continue;
      }

      // 放宽质量过滤: 分数≥5, 评论≥3, 点赞率≥0.05 (降低门槛)
      if (post.score < 5 || post.num_comments < 3 || (post.upvote_ratio && post.upvote_ratio < 0.05)) {
        this.stats.qualityFiltered++;
        continue;
      }

      // 检查是否被删除
      if (!post.author || post.author === '[deleted]' || post.title.includes('[deleted]')) {
        continue;
      }

      // 扩展AI相关性检查 (更宽松的关键词匹配)
      if (!this.checkAIRelevance(post.title, post.selftext)) {
        this.stats.aiFiltered++;
        continue;
      }

      // 构建帖子数据
      const processedPost = {
        id: post.id,
        subreddit: subreddit,
        title: post.title,
        selftext: post.selftext || '',
        url: post.url,
        post_url: `https://reddit.com${post.permalink}`,
        created_utc: post.created_utc,
        collected_at: now,
        collection_date: new Date().toISOString().split('T')[0],
        collection_batch_id: `enhanced_${Date.now()}`,
        author: post.author,
        score: post.score,
        num_comments: post.num_comments,
        upvote_ratio: post.upvote_ratio || 0,
        ups: post.ups || 0,
        downs: post.downs || 0,
        flair: post.link_flair_text || null,
        awards: JSON.stringify(post.all_awardings || []),
        is_self: post.is_self || false,
        is_video: post.is_video || false,
        ai_relevance_score: this.calculateAIRelevance(post.title, post.selftext),
        is_ai_related: true,
        post_age_days: Math.floor((now - post.created_utc) / (24 * 60 * 60))
      };

      validPosts.push(processedPost);
    }

    return { validPosts, duplicateCount };
  }

  checkAIRelevance(title, selftext) {
    // 扩展的AI关键词列表
    const aiKeywords = [
      // 基础AI术语
      'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'dl',
      'neural network', 'neural', 'algorithm', 'model', 'training', 'dataset',
      
      // 流行AI工具和公司
      'gpt', 'chatgpt', 'openai', 'anthropic', 'claude', 'gemini', 'bard',
      'llm', 'large language model', 'chatbot', 'bot', 'assistant',
      
      // 技术术语
      'transformer', 'bert', 'nlp', 'computer vision', 'cv', 'reinforcement learning',
      'pytorch', 'tensorflow', 'hugging face', 'langchain', 'rag', 'fine-tuning',
      
      // 创意AI工具
      'stable diffusion', 'midjourney', 'dall-e', 'imagen', 'diffusion',
      'text-to-image', 'image generation', 'ai art', 'generative',
      
      // 新兴概念
      'agi', 'artificial general intelligence', 'superintelligence', 'alignment',
      'prompt engineering', 'few-shot', 'zero-shot', 'embedding', 'vector',
      
      // 应用领域
      'automation', 'prediction', 'classification', 'recommendation', 'optimization',
      'voice', 'speech', 'vision', 'robotics', 'autonomous'
    ];
    
    const text = (title + ' ' + (selftext || '')).toLowerCase();
    return aiKeywords.some(keyword => text.includes(keyword));
  }

  calculateAIRelevance(title, selftext) {
    const text = (title + ' ' + (selftext || '')).toLowerCase();
    const coreKeywords = ['ai', 'artificial intelligence', 'machine learning', 'gpt', 'neural'];
    const matches = coreKeywords.filter(keyword => text.includes(keyword)).length;
    return Math.min(matches * 0.3, 1.0);
  }

  async crawlIncrementally(targetCount = 1000) {
    console.log('🚀 开始增强版增量Reddit AI帖子采集...');
    console.log(`🎯 目标: 新采集${targetCount}条最近60天的AI帖子`);
    console.log(`📋 社区数量: ${TARGET_SUBREDDITS.length}`);
    console.log('');

    // 加载当日已采集的帖子ID (避免当日重复)
    await this.loadExistingPostIds();

    // 认证
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      console.error('❌ 认证失败，无法继续');
      return;
    }

    console.log(`📊 平均每社区目标: ${Math.ceil(targetCount / TARGET_SUBREDDITS.length)} 新帖子`);
    console.log('');

    let currentCount = 0;
    const targetPerSubreddit = Math.ceil(targetCount / TARGET_SUBREDDITS.length);

    for (let i = 0; i < TARGET_SUBREDDITS.length && currentCount < targetCount; i++) {
      const subreddit = TARGET_SUBREDDITS[i];
      let subredditCount = 0;
      let after = null;
      let attempts = 0;
      const maxAttempts = 5; // 每个社区最多5页

      while (subredditCount < targetPerSubreddit && attempts < maxAttempts && currentCount < targetCount) {
        const result = await this.fetchSubredditPosts(subreddit, 100, after);
        const { validPosts, duplicateCount } = result.posts;
        
        // 过滤掉已经在newPosts中的帖子（避免同一次采集中的重复）
        const uniqueNewPosts = validPosts.filter(post => 
          !this.newPosts.some(existing => existing.id === post.id)
        );

        this.newPosts.push(...uniqueNewPosts);
        subredditCount += uniqueNewPosts.length;
        currentCount += uniqueNewPosts.length;

        console.log(`📥 [${i + 1}/${TARGET_SUBREDDITS.length}] r/${subreddit}: +${uniqueNewPosts.length} 新帖子, ${duplicateCount} 重复 (总计新帖子: ${currentCount})`);

        if (!result.hasMore || uniqueNewPosts.length === 0) {
          break;
        }

        after = result.after;
        attempts++;
        
        // API限制延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 进度更新
      if ((i + 1) % 5 === 0) {
        console.log(`🔄 进度更新: ${currentCount}/${targetCount} 新帖子已采集 (${Math.round(currentCount/targetCount*100)}%)`);
      }
    }

    console.log('');
    console.log(`📥 准备插入${this.newPosts.length}条新帖子到D1数据库...`);
    
    if (this.newPosts.length > 0) {
      await this.saveToDB();
      await this.saveToFile();
    } else {
      console.log('⚠️ 没有新帖子需要保存');
    }

    this.printSummary(targetCount);
  }

  async saveToDB() {
    const batchSize = 50;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < this.newPosts.length; i += batchSize) {
      const batch = this.newPosts.slice(i, i + batchSize);
      console.log(`   正在处理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(this.newPosts.length/batchSize)} (${batch.length} 条记录)...`);

      try {
        let sql = 'INSERT OR IGNORE INTO redditV2_posts (id, subreddit, title, selftext, url, post_url, created_utc, collected_at, collection_date, collection_batch_id, author, score, num_comments, upvote_ratio, ups, downs, flair, awards, is_self, is_video, ai_relevance_score, is_ai_related) VALUES ';
        
        const values = batch.map(post => {
          const escapedTitle = post.title.replace(/'/g, "''").substring(0, 500);
          const escapedSelftext = post.selftext ? post.selftext.replace(/'/g, "''").substring(0, 5000) : null;
          const escapedFlair = post.flair ? post.flair.replace(/'/g, "''") : null;
          const escapedAwards = post.awards ? post.awards.replace(/'/g, "''") : '[]';

          return `('${post.id}', '${post.subreddit}', '${escapedTitle}', ${escapedSelftext ? `'${escapedSelftext}'` : 'NULL'}, '${post.url}', '${post.post_url}', ${post.created_utc}, ${post.collected_at}, '${post.collection_date}', '${post.collection_batch_id}', '${post.author}', ${post.score}, ${post.num_comments}, ${post.upvote_ratio}, ${post.ups}, ${post.downs}, ${escapedFlair ? `'${escapedFlair}'` : 'NULL'}, '${escapedAwards}', ${post.is_self ? 1 : 0}, ${post.is_video ? 1 : 0}, ${post.ai_relevance_score}, ${post.is_ai_related ? 1 : 0})`;
        });

        sql += values.join(', ') + ';';

        const response = await fetch(`${this.d1BaseUrl}/query`, {
          method: 'POST',
          headers: this.d1Headers,
          body: JSON.stringify({ sql })
        });

        if (response.ok) {
          successCount += batch.length;
          console.log(`   ✅ 批次完成: ${batch.length} 条记录已插入`);
        } else {
          failCount += batch.length;
          console.log(`   ❌ 批次失败: ${response.status}`);
        }

      } catch (error) {
        failCount += batch.length;
        console.error(`   ❌ 批次失败:`, error.message);
      }
    }

    console.log('');
    console.log(`📊 插入结果:`);
    console.log(`   ✅ 成功: ${successCount} 条`);
    console.log(`   ❌ 失败: ${failCount} 条`);
    console.log(`   📈 成功率: ${Math.round(successCount/(successCount+failCount)*100)}%`);

    this.stats.finalSaved = successCount;
  }

  async saveToFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dataDir = path.join(__dirname, '../data');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dataFile = path.join(dataDir, `reddit-posts-enhanced-${timestamp}.json`);
    const statsFile = path.join(dataDir, `crawl-stats-enhanced-${timestamp}.json`);

    fs.writeFileSync(dataFile, JSON.stringify(this.newPosts, null, 2));
    fs.writeFileSync(statsFile, JSON.stringify({
      timestamp,
      stats: this.stats,
      targetCount: this.newPosts.length,
      subredditCount: TARGET_SUBREDDITS.length
    }, null, 2));

    console.log('');
    console.log(`💾 增强版数据保存完成:`);
    console.log(`   📄 新帖子数据: ${dataFile}`);
    console.log(`   📊 统计数据: ${statsFile}`);
  }

  printSummary(targetCount) {
    console.log('');
    console.log(`📋 增强版增量采集完成总结:`);
    console.log(`=====================================`);
    console.log(`📊 新采集帖子: ${this.newPosts.length}`);
    console.log(`🔄 跳过重复: ${this.stats.duplicateFiltered}`);
    console.log(`📈 新增比例: ${this.newPosts.length > 0 ? Math.round(this.newPosts.length/(this.newPosts.length + this.stats.duplicateFiltered)*100) : 0}%`);
    console.log(`🎯 目标完成率: ${Math.round(this.newPosts.length/targetCount*100)}%`);

    if (this.newPosts.length > 0) {
      // 时间分布
      const timeRanges = { '1天内': 0, '1-7天': 0, '7-14天': 0, '14-30天': 0, '30-60天': 0 };
      this.newPosts.forEach(post => {
        if (post.post_age_days <= 1) timeRanges['1天内']++;
        else if (post.post_age_days <= 7) timeRanges['1-7天']++;
        else if (post.post_age_days <= 14) timeRanges['7-14天']++;
        else if (post.post_age_days <= 30) timeRanges['14-30天']++;
        else timeRanges['30-60天']++;
      });

      console.log('');
      console.log(`📈 新帖子时间分布:`);
      Object.entries(timeRanges).forEach(([range, count]) => {
        const percentage = Math.round(count/this.newPosts.length*100);
        console.log(`   ${range}: ${count} 帖子 (${percentage}%)`);
      });

      // 社区贡献Top 10
      const subredditCounts = {};
      this.newPosts.forEach(post => {
        subredditCounts[post.subreddit] = (subredditCounts[post.subreddit] || 0) + 1;
      });

      const topSubreddits = Object.entries(subredditCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      console.log('');
      console.log(`🏆 新帖子社区贡献 Top 10:`);
      topSubreddits.forEach(([subreddit, count], index) => {
        console.log(`   ${index + 1}. r/${subreddit}: ${count} 新帖子`);
      });

      // 质量统计
      const avgScore = Math.round(this.newPosts.reduce((sum, post) => sum + post.score, 0) / this.newPosts.length);
      const avgComments = Math.round(this.newPosts.reduce((sum, post) => sum + post.num_comments, 0) / this.newPosts.length);
      const avgUpvoteRatio = (this.newPosts.reduce((sum, post) => sum + post.upvote_ratio, 0) / this.newPosts.length).toFixed(2);

      console.log('');
      console.log(`⭐ 新帖子质量统计:`);
      console.log(`   平均分数: ${avgScore}`);
      console.log(`   平均评论: ${avgComments}`);
      console.log(`   平均点赞率: ${avgUpvoteRatio}`);
    }

    console.log('');
    console.log(`📊 过滤统计:`);
    console.log(`   总获取: ${this.stats.totalFetched}`);
    console.log(`   时间过滤: ${this.stats.timeFiltered}`);
    console.log(`   质量过滤: ${this.stats.qualityFiltered}`);
    console.log(`   AI过滤: ${this.stats.aiFiltered}`);
    console.log(`   重复过滤: ${this.stats.duplicateFiltered}`);
    console.log(`   最终保存: ${this.stats.finalSaved}`);

    console.log('');
    console.log(`✅ 增强版Reddit AI帖子采集任务完成! 🎉`);
  }
}

// 执行采集
const targetCount = parseInt(process.argv[2]) || parseInt(process.env.DAILY_LIMIT) || 1000;
const crawler = new EnhancedIncrementalCrawler();
crawler.crawlIncrementally(targetCount);
