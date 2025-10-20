import { Env } from './types';
import { Logger } from './utils/logger';
import { validateEnvironmentOrThrow } from './config/environment';
import { RedditClient } from './modules/collector/reddit-client';
import { PostProcessor } from './modules/processor/post-processor';
import { SimpleDatabaseManager } from './modules/storage/simple-database-manager';
import { CollectionScheduler } from './modules/scheduler/collection-scheduler';
import { safeJSONParse } from './utils/helpers';

/**
 * Cloudflare Worker主入口
 * 处理HTTP请求并协调整个Reddit AI爬虫系统
 */

export default {
  /**
   * 处理HTTP请求
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const logger = new Logger('info', 'Worker');
    
    try {
      // 验证环境配置
      const envConfig = validateEnvironmentOrThrow(env);
      logger.info('Worker started', {
        url: request.url,
        method: request.method,
        environment: envConfig.getEnvironment()
      });

      const url = new URL(request.url);
      const path = url.pathname;

      // 路由处理
      switch (path) {
        case '/':
          return handleRoot(request, env, logger);
        
        case '/health':
          return handleHealthCheck(request, env, logger);
        
        case '/crawl':
          return handleCrawlRequest(request, env, logger);
        
        case '/status':
          return handleStatusRequest(request, env, logger);
        
        case '/stats':
          return handleStatsRequest(request, env, logger);
        
        default:
          return new Response('Not Found', { status: 404 });
      }

    } catch (error) {
      logger.error('Worker error', { error: error.message });
      return new Response(
        JSON.stringify({ 
          error: 'Internal Server Error', 
          message: error.message 
        }), 
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  },

  /**
   * 定时触发器（Cron）
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const logger = new Logger('info', 'CronWorker');
    
    try {
      logger.info('Scheduled crawl started', {
        scheduledTime: new Date(event.scheduledTime).toISOString(),
        cron: event.cron
      });

      // 验证环境配置
      const envConfig = validateEnvironmentOrThrow(env);
      
      // 执行自动采集
      const result = await executeAutoCrawl(env, logger);
      
      logger.info('Scheduled crawl completed', {
        status: result.status,
        totalSaved: result.summary.totalSaved,
        duration: Math.round(result.summary.duration / 1000)
      });

    } catch (error) {
      logger.error('Scheduled crawl failed', { error: error.message });
      
      // 记录错误到数据库
      try {
        const dbManager = new SimpleDatabaseManager(env, logger);
        await dbManager.logError({
          error_type: 'scheduled_crawl_failed',
          error_message: error.message,
          subreddit: null,
          collection_batch_id: null,
          severity: 'error',
          resolved: false
        });
      } catch (dbError) {
        logger.error('Failed to log error to database', { error: dbError.message });
      }
    }
  }
};

/**
 * 处理根路径请求
 */
async function handleRoot(request: Request, env: Env, logger: Logger): Promise<Response> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Reddit AI Crawler</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .endpoint { background: #e9e9e9; padding: 10px; margin: 10px 0; border-radius: 3px; }
        .method { color: #007cba; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🤖 Reddit AI Crawler</h1>
        <p>自动化Reddit AI相关帖子采集系统</p>
        <p>环境: ${env.ENVIRONMENT || 'development'} | 每日限制: ${env.DAILY_LIMIT || '2000'}</p>
      </div>
      
      <h2>可用端点</h2>
      
      <div class="endpoint">
        <span class="method">GET</span> /health - 系统健康检查
      </div>
      
      <div class="endpoint">
        <span class="method">POST</span> /crawl - 手动触发采集
      </div>
      
      <div class="endpoint">
        <span class="method">GET</span> /status - 获取系统状态
      </div>
      
      <div class="endpoint">
        <span class="method">GET</span> /stats - 获取采集统计
      </div>
      
      <h2>系统信息</h2>
      <ul>
        <li>每日采集限制: ${env.DAILY_LIMIT || '2000'} 帖子</li>
        <li>单次API调用限制: ${env.MAX_POSTS_PER_REQUEST || '80'} 帖子</li>
        <li>最小点赞率: ${env.MIN_UPVOTE_RATIO || '0.1'}</li>
        <li>API请求间隔: ${env.API_REQUEST_INTERVAL || '1000'}ms</li>
      </ul>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

/**
 * 处理健康检查请求
 */
async function handleHealthCheck(request: Request, env: Env, logger: Logger): Promise<Response> {
  try {
    const envConfig = validateEnvironmentOrThrow(env);
    const dbManager = new SimpleDatabaseManager(env, logger);
    
    // 检查数据库连接
    const dbHealthy = await dbManager.testConnection();
    
    // 检查Reddit API（轻量级检查）
    const redditClient = new RedditClient(
      envConfig.getRedditConfig().clientId,
      envConfig.getRedditConfig().clientSecret,
      envConfig.getRedditConfig().userAgent,
      logger,
      {
        maxRetries: 1,
        minIntervalMs: envConfig.getApiRequestInterval()
      }
    );

    const redditValidation = await redditClient.validateConnection();
    
    const health = {
      status: dbHealthy && redditValidation.isValid ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        reddit_api: redditValidation.isValid ? 'healthy' : 'unhealthy',
        environment: 'healthy'
      },
      version: '1.0.0'
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;

    return new Response(JSON.stringify(health, null, 2), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    return new Response(JSON.stringify({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    }, null, 2), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理爬取请求
 */
async function handleCrawlRequest(request: Request, env: Env, logger: Logger): Promise<Response> {
  try {
    // 只允许POST请求
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    logger.info('Manual crawl request received');

    // 执行采集
    const result = await executeAutoCrawl(env, logger);

    return new Response(JSON.stringify({
      success: true,
      batchId: result.batchId,
      status: result.status,
      summary: result.summary,
      quotaUsage: result.quotaUsage,
      subredditCount: result.subredditResults.length,
      errors: result.errors.length > 0 ? result.errors : undefined
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Manual crawl failed', { error: error.message });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理状态请求
 */
async function handleStatusRequest(request: Request, env: Env, logger: Logger): Promise<Response> {
  try {
    const envConfig = validateEnvironmentOrThrow(env);
    const dbManager = new SimpleDatabaseManager(env, logger);
    
    // 获取数据库健康状态
    const dbHealth = await dbManager.getHealthStatus();
    
    // 获取今日统计
    const todayStats = await dbManager.getTodayStats();

    const status = {
      timestamp: new Date().toISOString(),
      environment: envConfig.getEnvironment(),
      configuration: {
        dailyLimit: envConfig.getDailyLimit(),
        maxPostsPerRequest: envConfig.getMaxPostsPerRequest(),
        minUpvoteRatio: envConfig.getMinUpvoteRatio(),
        apiRequestInterval: envConfig.getApiRequestInterval()
      },
      database: dbHealth,
      todayStats
    };

    return new Response(JSON.stringify(status, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Status request failed', { error: error.message });
    
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理统计请求
 */
async function handleStatsRequest(request: Request, env: Env, logger: Logger): Promise<Response> {
  try {
    const dbManager = new SimpleDatabaseManager(env, logger);
    
    // 获取今日统计
    const todayStats = await dbManager.getTodayStats();
    
    // 获取最近帖子
    const recentPosts = await dbManager.getRecentPosts(20);

    const stats = {
      timestamp: new Date().toISOString(),
      today: todayStats,
      recentPosts: recentPosts.map(post => ({
        id: post.id,
        subreddit: post.subreddit,
        title: post.title.length > 100 ? post.title.substring(0, 97) + '...' : post.title,
        score: post.score,
        comments: post.num_comments,
        upvoteRatio: post.upvote_ratio,
        collectedAt: new Date(post.collected_at * 1000).toISOString()
      }))
    };

    return new Response(JSON.stringify(stats, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Stats request failed', { error: error.message });
    
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 执行自动采集流程
 */
async function executeAutoCrawl(env: Env, logger: Logger) {
  const envConfig = validateEnvironmentOrThrow(env);
  
  // 初始化组件
  const redditClient = new RedditClient(
    envConfig.getRedditConfig().clientId,
    envConfig.getRedditConfig().clientSecret,
    envConfig.getRedditConfig().userAgent,
    logger,
    {
      maxRetries: envConfig.getMaxRetries(),
      minIntervalMs: envConfig.getApiRequestInterval()
    }
  );

  const postProcessor = new PostProcessor(logger);
  const dbManager = new SimpleDatabaseManager(env, logger);
  
  const scheduler = new CollectionScheduler(
    logger,
    redditClient,
    postProcessor,
    dbManager,
    {
      dailyLimit: envConfig.getDailyLimit(),
      maxConcurrentBatches: 1 // 保守设置，避免API限制
    }
  );

  // 加载社区配置
  const subredditConfigs = await loadSubredditConfigs(env);

  // 执行采集
  const result = await scheduler.executeCollection(subredditConfigs, {
    enableAIDetection: true,
    aiThreshold: 2.0,
    continueOnError: true,
    timeout: 300000 // 5分钟超时
  });

  return result;
}

/**
 * 加载社区配置
 */
async function loadSubredditConfigs(env: Env): Promise<Array<{
  name: string;
  priority: number;
  dailyQuota: number;
  minScore: number;
  minComments: number;
  minUpvoteRatio: number;
  maxPostsPerRequest: number;
  isActive: boolean;
}>> {
  // 在实际环境中，这里会从配置文件或数据库加载
  // 现在使用硬编码的配置
  const configs = [
    // Tier 1 - 高优先级社区
    { name: 'MachineLearning', priority: 1, dailyQuota: 100, minScore: 15, minComments: 8, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'artificial', priority: 1, dailyQuota: 80, minScore: 15, minComments: 8, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'deeplearning', priority: 1, dailyQuota: 80, minScore: 15, minComments: 8, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'LocalLLaMA', priority: 1, dailyQuota: 70, minScore: 15, minComments: 8, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'ChatGPT', priority: 1, dailyQuota: 70, minScore: 15, minComments: 8, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },

    // Tier 2 - 中等优先级社区
    { name: 'OpenAI', priority: 2, dailyQuota: 60, minScore: 10, minComments: 5, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'computervision', priority: 2, dailyQuota: 60, minScore: 10, minComments: 5, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'NLP', priority: 2, dailyQuota: 60, minScore: 10, minComments: 5, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'MLPapers', priority: 2, dailyQuota: 50, minScore: 10, minComments: 5, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'StableDiffusion', priority: 2, dailyQuota: 50, minScore: 10, minComments: 5, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'ArtificialInteligence', priority: 2, dailyQuota: 50, minScore: 10, minComments: 5, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'singularity', priority: 2, dailyQuota: 50, minScore: 10, minComments: 5, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'AI_Agents', priority: 2, dailyQuota: 50, minScore: 10, minComments: 5, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },

    // Tier 3 - 标准优先级社区
    { name: 'agi', priority: 3, dailyQuota: 40, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'neuralnetworks', priority: 3, dailyQuota: 40, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'datasets', priority: 3, dailyQuota: 30, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'voiceai', priority: 3, dailyQuota: 30, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'MediaSynthesis', priority: 3, dailyQuota: 30, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'GPT3', priority: 3, dailyQuota: 30, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'grok', priority: 3, dailyQuota: 30, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'ClaudeAI', priority: 3, dailyQuota: 30, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'aivideo', priority: 3, dailyQuota: 25, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'IndianArtAI', priority: 3, dailyQuota: 25, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'gameai', priority: 3, dailyQuota: 25, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'GoogleGeminiAI', priority: 3, dailyQuota: 25, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'NovelAi', priority: 3, dailyQuota: 25, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'KindroidAI', priority: 3, dailyQuota: 20, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'WritingWithAI', priority: 3, dailyQuota: 20, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true },
    { name: 'Qwen_AI', priority: 3, dailyQuota: 20, minScore: 8, minComments: 3, minUpvoteRatio: 0.1, maxPostsPerRequest: 80, isActive: true }
  ];

  return configs;
}