// 完整的2000条Reddit AI帖子采集脚本
// 获取最近30天内的真实AI帖子

const fs = require('fs');
const path = require('path');

const REDDIT_CLIENT_ID = 'NJnkQLyA6Gie7rGvCI3zYg';
const REDDIT_CLIENT_SECRET = 'WHFMSNNZBt1gV5xC394LGhrr5LzyPQ';
const USER_AGENT = 'reddit-ai-crawler/1.0.0 (by /u/ai_researcher)';

// 29个AI相关社区
const TARGET_SUBREDDITS = [
  'MachineLearning', 'artificial', 'deeplearning', 'LocalLLaMA', 'ChatGPT',
  'OpenAI', 'computervision', 'NLP', 'MLPapers', 'StableDiffusion',
  'ArtificialInteligence', 'singularity', 'AI_Agents', 'agi', 'neuralnetworks',
  'datasets', 'voiceai', 'MediaSynthesis', 'GPT3', 'grok',
  'ClaudeAI', 'aivideo', 'IndianArtAI', 'gameai', 'GoogleGeminiAI',
  'NovelAi', 'KindroidAI', 'WritingWithAI', 'Qwen_AI'
];

class FullRedditCrawler {
  constructor() {
    this.accessToken = null;
    this.allPosts = [];
    this.stats = {
      totalFetched: 0,
      totalFiltered: 0,
      subredditStats: {},
      errors: []
    };
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

  async fetchSubredditPosts(subreddit, limit = 80, after = null) {
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
    
    for (const child of children) {
      const post = child.data;
      
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

      // ✅ 按用户要求修正：目标AI社区的帖子无需额外AI关键词过滤
      // 既然是29个精选AI社区，其中符合质量标准的帖子都应该被采集

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

  async crawlAllSubreddits(targetCount = 2000) {
    console.log('🚀 开始完整的Reddit AI帖子采集...');
    console.log(`🎯 目标: 采集${targetCount}条最近30天的AI帖子`);
    console.log(`📋 社区数量: ${TARGET_SUBREDDITS.length}`);
    console.log('');

    // 认证
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      return false;
    }

    // 计算每个社区的目标帖子数
    const postsPerSubreddit = Math.ceil(targetCount / TARGET_SUBREDDITS.length);
    console.log(`📊 平均每社区目标: ${postsPerSubreddit} 帖子`);
    console.log('');

    let totalCollected = 0;

    for (let i = 0; i < TARGET_SUBREDDITS.length && totalCollected < targetCount; i++) {
      const subreddit = TARGET_SUBREDDITS[i];
      
      try {
        console.log(`📥 [${i+1}/${TARGET_SUBREDDITS.length}] 正在采集 r/${subreddit}...`);
        
        let subredditPosts = [];
        let after = null;
        let attempts = 0;
        const maxAttempts = 3; // 每个社区最多3次请求

        while (subredditPosts.length < postsPerSubreddit && attempts < maxAttempts && totalCollected < targetCount) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒间隔
          
          const result = await this.fetchSubredditPosts(subreddit, 80, after);
          const newPosts = result.posts.filter(post => 
            !this.allPosts.some(existing => existing.id === post.id) // 去重
          );
          
          subredditPosts.push(...newPosts);
          after = result.after;
          attempts++;

          if (!after || newPosts.length === 0) {
            break; // 没有更多帖子了
          }
        }

        // 限制每个社区的帖子数量
        const remainingSlots = targetCount - totalCollected;
        const postsToAdd = subredditPosts.slice(0, Math.min(postsPerSubreddit, remainingSlots));
        
        this.allPosts.push(...postsToAdd);
        totalCollected += postsToAdd.length;

        // 统计信息
        this.stats.subredditStats[subreddit] = {
          fetched: subredditPosts.length,
          added: postsToAdd.length,
          attempts: attempts
        };

        console.log(`   ✅ r/${subreddit}: ${postsToAdd.length} 帖子已采集 (总计: ${totalCollected})`);

      } catch (error) {
        console.error(`❌ 处理 r/${subreddit} 时出错:`, error.message);
        this.stats.errors.push(`r/${subreddit}: ${error.message}`);
      }

      // 进度更新
      if ((i + 1) % 5 === 0) {
        console.log(`🔄 进度更新: ${totalCollected}/${targetCount} 帖子已采集 (${Math.round(totalCollected/targetCount*100)}%)`);
      }
    }

    this.stats.totalFetched = this.allPosts.length;
    this.stats.totalFiltered = this.allPosts.length;

    return true;
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dataDir = path.join(__dirname, '..', 'data');
    
    // 确保数据目录存在
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 保存帖子数据
    const postsFile = path.join(dataDir, `reddit-posts-${timestamp}.json`);
    fs.writeFileSync(postsFile, JSON.stringify(this.allPosts, null, 2));

    // 保存统计数据
    const statsFile = path.join(dataDir, `crawl-stats-${timestamp}.json`);
    fs.writeFileSync(statsFile, JSON.stringify(this.stats, null, 2));

    // 生成SQL插入语句
    const sqlFile = path.join(dataDir, `insert-posts-${timestamp}.sql`);
    let sqlContent = '';
    
    for (const post of this.allPosts) {
      const values = [
        `'${post.id}'`,
        `'${post.subreddit}'`,
        `'${post.title.replace(/'/g, "''")}'`,
        post.selftext ? `'${post.selftext.replace(/'/g, "''").substring(0, 5000)}'` : 'NULL',
        `'${post.url}'`,
        `'${post.post_url}'`,
        post.created_utc,
        post.collected_at,
        `'${post.collection_date}'`,
        `'batch_${timestamp}'`,
        `'${post.author}'`,
        post.score,
        post.num_comments,
        post.upvote_ratio,
        post.ups,
        post.downs,
        post.flair ? `'${post.flair.replace(/'/g, "''")}'` : 'NULL',
        'NULL', // awards
        post.is_self ? 1 : 0,
        post.is_video ? 1 : 0,
        post.ai_relevance_score,
        post.is_ai_related ? 1 : 0
      ];
      
      sqlContent += `INSERT INTO redditV2_posts (id, subreddit, title, selftext, url, post_url, created_utc, collected_at, collection_date, collection_batch_id, author, score, num_comments, upvote_ratio, ups, downs, flair, awards, is_self, is_video, ai_relevance_score, is_ai_related) VALUES (${values.join(', ')});\n`;
    }
    
    fs.writeFileSync(sqlFile, sqlContent);

    console.log('');
    console.log('💾 数据保存完成:');
    console.log(`   📄 帖子数据: ${postsFile}`);
    console.log(`   📊 统计数据: ${statsFile}`);
    console.log(`   🗃️ SQL文件: ${sqlFile}`);

    return { postsFile, statsFile, sqlFile };
  }

  printSummary() {
    console.log('');
    console.log('📋 采集完成总结:');
    console.log('=====================================');
    console.log(`📊 总采集帖子: ${this.stats.totalFetched}`);
    console.log(`🎯 目标完成度: ${Math.round(this.stats.totalFetched/2000*100)}%`);
    
    if (this.allPosts.length > 0) {
      // 时间分布
      const timeRanges = { '1天内': 0, '1-7天': 0, '7-14天': 0, '14-30天': 0 };
      this.allPosts.forEach(post => {
        if (post.post_age_days <= 1) timeRanges['1天内']++;
        else if (post.post_age_days <= 7) timeRanges['1-7天']++;
        else if (post.post_age_days <= 14) timeRanges['7-14天']++;
        else timeRanges['14-30天']++;
      });

      console.log('');
      console.log('📈 时间分布:');
      Object.entries(timeRanges).forEach(([range, count]) => {
        console.log(`   ${range}: ${count} 帖子 (${Math.round(count/this.allPosts.length*100)}%)`);
      });

      // 社区分布 (Top 10)
      const subredditCounts = {};
      this.allPosts.forEach(post => {
        subredditCounts[post.subreddit] = (subredditCounts[post.subreddit] || 0) + 1;
      });

      console.log('');
      console.log('🏆 社区贡献 Top 10:');
      Object.entries(subredditCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([subreddit, count], index) => {
          console.log(`   ${index + 1}. r/${subreddit}: ${count} 帖子`);
        });

      // 质量统计
      const avgScore = Math.round(this.allPosts.reduce((sum, post) => sum + post.score, 0) / this.allPosts.length);
      const avgComments = Math.round(this.allPosts.reduce((sum, post) => sum + post.num_comments, 0) / this.allPosts.length);
      const avgRatio = (this.allPosts.reduce((sum, post) => sum + post.upvote_ratio, 0) / this.allPosts.length).toFixed(2);

      console.log('');
      console.log('⭐ 质量统计:');
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
    console.log('✅ Reddit AI帖子采集任务完成! 🎉');
  }
}

// 执行采集
async function main() {
  const crawler = new FullRedditCrawler();
  
  try {
    const success = await crawler.crawlAllSubreddits(2000);
    if (success) {
      await crawler.saveResults();
      crawler.printSummary();
    }
  } catch (error) {
    console.error('❌ 采集过程中出现错误:', error);
  }
}

main().catch(console.error);
