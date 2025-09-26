#!/usr/bin/env node

/**
 * 诊断采集数据量少的原因
 */

const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || 'NJnkQLyA6Gie7rGvCI3zYg';
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || 'WHFMSNNZBt1gV5xC394LGhrr5LzyPQ';
const REDDIT_USER_AGENT = 'reddit-ai-collect_v3/3.0.0 (by /u/ai_researcher)';

const TARGET_SUBREDDITS = [
  'MachineLearning', 'artificial', 'deeplearning', 'LocalLLaMA', 'ChatGPT'
]; // 只测试前5个社区

class CrawlDiagnostic {
  constructor() {
    this.accessToken = null;
    this.stats = {
      totalFetched: 0,
      timeFiltered: 0,
      qualityFiltered: 0,
      deletedFiltered: 0,
      aiFiltered: 0,
      duplicateFiltered: 0,
      finalCount: 0
    };
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
      return !!this.accessToken;
    } catch (error) {
      console.error('❌ 认证失败:', error.message);
      return false;
    }
  }

  async fetchSubredditPosts(subreddit, limit = 25) {
    const url = `https://oauth.reddit.com/r/${subreddit}/hot?limit=${limit}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'User-Agent': REDDIT_USER_AGENT
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.data.children;
    } catch (error) {
      console.error(`❌ 获取 r/${subreddit} 失败:`, error.message);
      return [];
    }
  }

  analyzePost(post) {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    
    const analysis = {
      id: post.id,
      title: post.title.substring(0, 50) + '...',
      score: post.score,
      comments: post.num_comments,
      upvote_ratio: post.upvote_ratio,
      age_days: Math.floor((now - post.created_utc) / (24 * 60 * 60)),
      author: post.author,
      filters: {
        timeOk: post.created_utc >= thirtyDaysAgo,
        qualityOk: post.score >= 10 && post.num_comments >= 5 && (!post.upvote_ratio || post.upvote_ratio >= 0.1),
        notDeleted: post.author && post.author !== '[deleted]' && !post.title.includes('[deleted]'),
        aiRelated: this.checkAIRelevance(post.title + ' ' + (post.selftext || ''))
      }
    };

    analysis.passesAll = Object.values(analysis.filters).every(f => f);
    return analysis;
  }

  checkAIRelevance(text) {
    const aiKeywords = [
      'ai', 'artificial intelligence', 'machine learning', 'deep learning', 
      'neural network', 'gpt', 'llm', 'chatbot', 'openai', 'anthropic',
      'claude', 'gemini', 'stable diffusion', 'midjourney', 'transformer'
    ];
    
    const lowerText = text.toLowerCase();
    return aiKeywords.some(keyword => lowerText.includes(keyword));
  }

  async diagnoseSubreddit(subreddit) {
    console.log(`\n🔍 分析 r/${subreddit}...`);
    
    const children = await this.fetchSubredditPosts(subreddit, 50);
    console.log(`  📥 获取到 ${children.length} 个帖子`);
    
    const analyses = children.map(child => this.analyzePost(child.data));
    
    const stats = {
      total: analyses.length,
      timeOk: analyses.filter(a => a.filters.timeOk).length,
      qualityOk: analyses.filter(a => a.filters.qualityOk).length,
      notDeleted: analyses.filter(a => a.filters.notDeleted).length,
      aiRelated: analyses.filter(a => a.filters.aiRelated).length,
      passesAll: analyses.filter(a => a.passesAll).length
    };

    console.log(`  ⏰ 时间过滤 (30天内): ${stats.timeOk}/${stats.total} (${(stats.timeOk/stats.total*100).toFixed(1)}%)`);
    console.log(`  💎 质量过滤 (分数≥10, 评论≥5, 点赞率≥0.1): ${stats.qualityOk}/${stats.total} (${(stats.qualityOk/stats.total*100).toFixed(1)}%)`);
    console.log(`  🚫 非删除过滤: ${stats.notDeleted}/${stats.total} (${(stats.notDeleted/stats.total*100).toFixed(1)}%)`);
    console.log(`  🤖 AI相关过滤: ${stats.aiRelated}/${stats.total} (${(stats.aiRelated/stats.total*100).toFixed(1)}%)`);
    console.log(`  ✅ 通过所有过滤: ${stats.passesAll}/${stats.total} (${(stats.passesAll/stats.total*100).toFixed(1)}%)`);

    // 显示未通过的帖子示例
    const failed = analyses.filter(a => !a.passesAll).slice(0, 3);
    if (failed.length > 0) {
      console.log(`  📋 未通过示例:`);
      failed.forEach(f => {
        const reasons = [];
        if (!f.filters.timeOk) reasons.push('时间超限');
        if (!f.filters.qualityOk) reasons.push(`质量不足(${f.score}分,${f.comments}评论)`);
        if (!f.filters.notDeleted) reasons.push('已删除');
        if (!f.filters.aiRelated) reasons.push('非AI相关');
        console.log(`    - ${f.title} [${reasons.join(', ')}]`);
      });
    }

    return stats;
  }

  async runDiagnosis() {
    console.log('🚀 开始采集诊断...');
    console.log(`🎯 测试社区: ${TARGET_SUBREDDITS.join(', ')}`);
    
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      console.error('❌ 认证失败，无法继续诊断');
      return;
    }
    console.log('✅ Reddit API认证成功');

    let totalStats = { total: 0, timeOk: 0, qualityOk: 0, notDeleted: 0, aiRelated: 0, passesAll: 0 };

    for (const subreddit of TARGET_SUBREDDITS) {
      const stats = await this.diagnoseSubreddit(subreddit);
      
      totalStats.total += stats.total;
      totalStats.timeOk += stats.timeOk;
      totalStats.qualityOk += stats.qualityOk;
      totalStats.notDeleted += stats.notDeleted;
      totalStats.aiRelated += stats.aiRelated;
      totalStats.passesAll += stats.passesAll;

      await new Promise(resolve => setTimeout(resolve, 1000)); // 避免API限制
    }

    console.log('\n📊 总体诊断结果:');
    console.log('=====================================');
    console.log(`📥 总获取帖子数: ${totalStats.total}`);
    console.log(`⏰ 时间过滤通过率: ${(totalStats.timeOk/totalStats.total*100).toFixed(1)}% (${totalStats.timeOk}/${totalStats.total})`);
    console.log(`💎 质量过滤通过率: ${(totalStats.qualityOk/totalStats.total*100).toFixed(1)}% (${totalStats.qualityOk}/${totalStats.total})`);
    console.log(`🚫 非删除过滤通过率: ${(totalStats.notDeleted/totalStats.total*100).toFixed(1)}% (${totalStats.notDeleted}/${totalStats.total})`);
    console.log(`🤖 AI相关过滤通过率: ${(totalStats.aiRelated/totalStats.total*100).toFixed(1)}% (${totalStats.aiRelated}/${totalStats.total})`);
    console.log(`✅ 最终通过率: ${(totalStats.passesAll/totalStats.total*100).toFixed(1)}% (${totalStats.passesAll}/${totalStats.total})`);

    console.log('\n💡 结论:');
    if (totalStats.passesAll / totalStats.total < 0.1) {
      console.log('❌ 过滤条件过于严格，通过率 < 10%');
      console.log('🔧 建议: 放宽质量标准或AI关键词匹配');
    } else if (totalStats.passesAll / totalStats.total < 0.3) {
      console.log('⚠️ 过滤条件较严格，通过率 < 30%');
      console.log('🔧 建议: 适当调整过滤参数');
    } else {
      console.log('✅ 过滤条件合理');
      console.log('🔧 如果采集量仍然少，可能是增量过滤导致（大部分帖子已被采集）');
    }
  }
}

// 运行诊断
const diagnostic = new CrawlDiagnostic();
diagnostic.runDiagnosis().catch(console.error);
