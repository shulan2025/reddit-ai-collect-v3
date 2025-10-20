import { RedditPost, Logger } from '../../types';
import { cleanText, safeJSONParse } from '../../utils/helpers';

/**
 * AI相关性检测器
 * 使用关键词匹配和简单规则来判断帖子是否与AI相关
 */
export class AIRelevanceDetector {
  private logger: Logger;
  private keywordsCache: AIKeywords | null = null;

  constructor(logger: Logger) {
    this.logger = logger.child('AIDetector');
  }

  /**
   * 检测帖子的AI相关性
   */
  async detectAIRelevance(post: RedditPost): Promise<{
    isAIRelated: boolean;
    relevanceScore: number;
    matchedKeywords: string[];
    confidence: 'high' | 'medium' | 'low';
    reasons: string[];
  }> {
    try {
      // 加载关键词
      const keywords = await this.loadKeywords();
      
      // 准备文本内容
      const text = this.prepareTextForAnalysis(post);
      
      // 执行关键词匹配
      const matchResult = this.matchKeywords(text, keywords);
      
      // 计算相关性评分
      const relevanceScore = this.calculateRelevanceScore(matchResult, post);
      
      // 判断是否AI相关
      const isAIRelated = relevanceScore >= 2.0;
      
      // 确定置信度
      const confidence = this.determineConfidence(relevanceScore, matchResult.matchedKeywords.length);
      
      // 生成判断理由
      const reasons = this.generateReasons(matchResult, relevanceScore, post);

      this.logger.debug('AI relevance detection completed', {
        postId: post.id,
        subreddit: post.subreddit,
        isAIRelated,
        relevanceScore,
        matchedKeywords: matchResult.matchedKeywords.length,
        confidence
      });

      return {
        isAIRelated,
        relevanceScore: Math.round(relevanceScore * 100) / 100, // 保留2位小数
        matchedKeywords: matchResult.matchedKeywords,
        confidence,
        reasons
      };

    } catch (error) {
      this.logger.error('AI relevance detection failed', {
        postId: post.id,
        error: error.message
      });

      // 返回默认结果（假设相关，避免误过滤）
      return {
        isAIRelated: true,
        relevanceScore: 1.0,
        matchedKeywords: [],
        confidence: 'low',
        reasons: ['Detection failed, assuming AI-related']
      };
    }
  }

  /**
   * 批量检测多个帖子的AI相关性
   */
  async batchDetectAIRelevance(posts: RedditPost[]): Promise<Map<string, {
    isAIRelated: boolean;
    relevanceScore: number;
    matchedKeywords: string[];
    confidence: 'high' | 'medium' | 'low';
  }>> {
    const results = new Map();
    
    this.logger.info('Starting batch AI relevance detection', {
      totalPosts: posts.length
    });

    // 预加载关键词
    await this.loadKeywords();

    let processed = 0;
    for (const post of posts) {
      const result = await this.detectAIRelevance(post);
      results.set(post.id, {
        isAIRelated: result.isAIRelated,
        relevanceScore: result.relevanceScore,
        matchedKeywords: result.matchedKeywords,
        confidence: result.confidence
      });
      
      processed++;
      if (processed % 100 === 0) {
        this.logger.debug('Batch processing progress', {
          processed,
          total: posts.length,
          progress: Math.round((processed / posts.length) * 100)
        });
      }
    }

    const aiRelatedCount = Array.from(results.values()).filter(r => r.isAIRelated).length;
    
    this.logger.info('Batch AI relevance detection completed', {
      totalPosts: posts.length,
      aiRelatedPosts: aiRelatedCount,
      nonAiRelatedPosts: posts.length - aiRelatedCount,
      aiRelatedPercentage: Math.round((aiRelatedCount / posts.length) * 100)
    });

    return results;
  }

  /**
   * 准备文本用于分析
   */
  private prepareTextForAnalysis(post: RedditPost): string {
    const titleText = cleanText(post.title || '');
    const bodyText = cleanText(post.selftext || '');
    const flairText = cleanText(post.flair || '');
    
    // 组合所有文本，标题权重更高
    return `${titleText} ${titleText} ${bodyText} ${flairText}`.toLowerCase();
  }

  /**
   * 关键词匹配
   */
  private matchKeywords(text: string, keywords: AIKeywords): {
    matchedKeywords: string[];
    highRelevanceMatches: number;
    mediumRelevanceMatches: number;
    technologyMatches: number;
    applicationMatches: number;
  } {
    const matchedKeywords: string[] = [];
    let highRelevanceMatches = 0;
    let mediumRelevanceMatches = 0;
    let technologyMatches = 0;
    let applicationMatches = 0;

    // 检查高相关性关键词
    for (const keyword of keywords.high_relevance_keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        highRelevanceMatches++;
      }
    }

    // 检查中等相关性关键词
    for (const keyword of keywords.medium_relevance_keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        mediumRelevanceMatches++;
      }
    }

    // 检查技术关键词
    for (const keyword of keywords.technology_keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        technologyMatches++;
      }
    }

    // 检查应用关键词
    for (const keyword of keywords.application_keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        applicationMatches++;
      }
    }

    return {
      matchedKeywords: [...new Set(matchedKeywords)], // 去重
      highRelevanceMatches,
      mediumRelevanceMatches,
      technologyMatches,
      applicationMatches
    };
  }

  /**
   * 计算相关性评分
   */
  private calculateRelevanceScore(
    matchResult: ReturnType<typeof this.matchKeywords>,
    post: RedditPost
  ): number {
    let score = 0;

    // 高相关性关键词评分 (权重: 3.0)
    score += matchResult.highRelevanceMatches * 3.0;

    // 中等相关性关键词评分 (权重: 2.0)
    score += matchResult.mediumRelevanceMatches * 2.0;

    // 技术关键词评分 (权重: 1.5)
    score += matchResult.technologyMatches * 1.5;

    // 应用关键词评分 (权重: 1.0)
    score += matchResult.applicationMatches * 1.0;

    // 社区奖励（某些社区天然更相关）
    const aiSubreddits = [
      'artificial', 'machinelearning', 'deeplearning', 'chatgpt', 
      'openai', 'localllama', 'agi', 'singularity'
    ];
    
    if (aiSubreddits.includes(post.subreddit.toLowerCase())) {
      score += 1.0;
    }

    // 帖子热度奖励（热门帖子可能更相关）
    if (post.score > 100) {
      score += 0.5;
    }
    if (post.num_comments > 50) {
      score += 0.3;
    }

    return score;
  }

  /**
   * 确定置信度
   */
  private determineConfidence(
    relevanceScore: number, 
    matchedKeywordsCount: number
  ): 'high' | 'medium' | 'low' {
    if (relevanceScore >= 5.0 && matchedKeywordsCount >= 3) {
      return 'high';
    } else if (relevanceScore >= 2.0 && matchedKeywordsCount >= 1) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 生成判断理由
   */
  private generateReasons(
    matchResult: ReturnType<typeof this.matchKeywords>,
    relevanceScore: number,
    post: RedditPost
  ): string[] {
    const reasons: string[] = [];

    if (matchResult.highRelevanceMatches > 0) {
      reasons.push(`High relevance keywords: ${matchResult.highRelevanceMatches}`);
    }

    if (matchResult.mediumRelevanceMatches > 0) {
      reasons.push(`Medium relevance keywords: ${matchResult.mediumRelevanceMatches}`);
    }

    if (matchResult.technologyMatches > 0) {
      reasons.push(`Technology keywords: ${matchResult.technologyMatches}`);
    }

    if (matchResult.applicationMatches > 0) {
      reasons.push(`Application keywords: ${matchResult.applicationMatches}`);
    }

    const aiSubreddits = ['artificial', 'machinelearning', 'deeplearning', 'chatgpt', 'openai'];
    if (aiSubreddits.includes(post.subreddit.toLowerCase())) {
      reasons.push('Posted in AI-focused subreddit');
    }

    if (post.score > 100) {
      reasons.push('High engagement score');
    }

    if (relevanceScore < 2.0) {
      reasons.push('Low overall relevance score');
    }

    return reasons;
  }

  /**
   * 加载AI关键词
   */
  private async loadKeywords(): Promise<AIKeywords> {
    if (this.keywordsCache) {
      return this.keywordsCache;
    }

    try {
      // 在实际环境中，这里会从配置文件加载
      // 现在我们使用硬编码的关键词
      const keywords: AIKeywords = {
        high_relevance_keywords: [
          'artificial intelligence', 'machine learning', 'deep learning',
          'neural network', 'transformer', 'gpt', 'chatgpt', 'openai',
          'claude', 'gemini', 'llm', 'large language model', 'generative ai',
          'stable diffusion', 'midjourney', 'dall-e'
        ],
        medium_relevance_keywords: [
          'ai', 'ml', 'dl', 'algorithm', 'model', 'training',
          'inference', 'fine-tuning', 'prompt engineering', 'nlp',
          'computer vision', 'reinforcement learning', 'supervised learning'
        ],
        technology_keywords: [
          'tensorflow', 'pytorch', 'keras', 'hugging face', 'transformers',
          'cuda', 'gpu', 'tpu', 'python', 'jupyter', 'colab',
          'langchain', 'vector database', 'embedding', 'attention mechanism'
        ],
        application_keywords: [
          'chatbot', 'virtual assistant', 'recommendation system',
          'image recognition', 'speech recognition', 'text generation',
          'image generation', 'code generation', 'translation',
          'sentiment analysis', 'classification', 'regression'
        ]
      };

      this.keywordsCache = keywords;
      this.logger.info('AI keywords loaded successfully', {
        highRelevanceCount: keywords.high_relevance_keywords.length,
        mediumRelevanceCount: keywords.medium_relevance_keywords.length,
        technologyCount: keywords.technology_keywords.length,
        applicationCount: keywords.application_keywords.length
      });

      return keywords;

    } catch (error) {
      this.logger.error('Failed to load AI keywords', { error: error.message });
      
      // 返回基础关键词作为fallback
      const fallbackKeywords: AIKeywords = {
        high_relevance_keywords: ['artificial intelligence', 'machine learning', 'ai', 'ml'],
        medium_relevance_keywords: ['algorithm', 'model', 'neural', 'deep learning'],
        technology_keywords: ['python', 'tensorflow', 'pytorch'],
        application_keywords: ['chatbot', 'image recognition']
      };

      this.keywordsCache = fallbackKeywords;
      return fallbackKeywords;
    }
  }

  /**
   * 清除关键词缓存
   */
  clearKeywordsCache(): void {
    this.keywordsCache = null;
    this.logger.debug('Keywords cache cleared');
  }

  /**
   * 获取检测器统计信息
   */
  getStats(): {
    keywordsLoaded: boolean;
    totalKeywords: number;
    keywordBreakdown: {
      highRelevance: number;
      mediumRelevance: number;
      technology: number;
      application: number;
    };
  } {
    if (!this.keywordsCache) {
      return {
        keywordsLoaded: false,
        totalKeywords: 0,
        keywordBreakdown: {
          highRelevance: 0,
          mediumRelevance: 0,
          technology: 0,
          application: 0
        }
      };
    }

    const breakdown = {
      highRelevance: this.keywordsCache.high_relevance_keywords.length,
      mediumRelevance: this.keywordsCache.medium_relevance_keywords.length,
      technology: this.keywordsCache.technology_keywords.length,
      application: this.keywordsCache.application_keywords.length
    };

    const totalKeywords = Object.values(breakdown).reduce((sum, count) => sum + count, 0);

    return {
      keywordsLoaded: true,
      totalKeywords,
      keywordBreakdown: breakdown
    };
  }
}

/**
 * AI关键词接口
 */
interface AIKeywords {
  high_relevance_keywords: string[];
  medium_relevance_keywords: string[];
  technology_keywords: string[];
  application_keywords: string[];
}
