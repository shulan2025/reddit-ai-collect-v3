import { RedditPost } from '../../../types';
import { cleanText, isValidRedditPostId, redditTimeToUTC } from '../../../utils/helpers';

/**
 * Reddit帖子数据模型
 * 负责数据验证、清理和转换
 */
export class RedditPostModel {
  /**
   * 验证Reddit帖子数据
   */
  static validate(post: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 必需字段验证
    if (!post.id || typeof post.id !== 'string') {
      errors.push('Invalid post ID');
    } else if (!isValidRedditPostId(post.id)) {
      errors.push('Invalid Reddit post ID format');
    }

    if (!post.subreddit || typeof post.subreddit !== 'string') {
      errors.push('Invalid subreddit');
    }

    if (!post.title || typeof post.title !== 'string' || post.title.trim().length === 0) {
      errors.push('Invalid title');
    }

    if (typeof post.created_utc !== 'number' || post.created_utc <= 0) {
      errors.push('Invalid created_utc timestamp');
    }

    // 数值字段验证
    if (typeof post.score !== 'number') {
      errors.push('Invalid score');
    }

    if (typeof post.num_comments !== 'number' || post.num_comments < 0) {
      errors.push('Invalid num_comments');
    }

    if (post.upvote_ratio !== null && 
        (typeof post.upvote_ratio !== 'number' || 
         post.upvote_ratio < 0 || 
         post.upvote_ratio > 1)) {
      errors.push('Invalid upvote_ratio');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 清理和标准化Reddit帖子数据
   */
  static clean(post: any): RedditPost {
    return {
      id: post.id.toString().trim(),
      subreddit: post.subreddit.toString().trim(),
      title: cleanText(post.title || ''),
      selftext: post.selftext ? cleanText(post.selftext) : null,
      url: post.url || null,
      created_utc: redditTimeToUTC(post.created_utc),
      author: post.author && post.author !== '[deleted]' ? post.author.toString().trim() : null,
      score: Math.max(0, Math.floor(post.score || 0)),
      num_comments: Math.max(0, Math.floor(post.num_comments || 0)),
      upvote_ratio: post.upvote_ratio !== null ? 
        Math.max(0, Math.min(1, parseFloat(post.upvote_ratio) || 0)) : null,
      ups: Math.max(0, Math.floor(post.ups || 0)),
      downs: Math.max(0, Math.floor(post.downs || 0)),
      flair: post.link_flair_text || post.flair || null,
      awards: post.all_awardings || post.awards || null,
      is_self: Boolean(post.is_self),
      is_video: Boolean(post.is_video || post.is_reddit_media_domain)
    };
  }

  /**
   * 从Reddit API响应转换为内部数据格式
   */
  static fromRedditAPI(apiPost: any): RedditPost | null {
    try {
      // 验证数据
      const validation = this.validate(apiPost);
      if (!validation.isValid) {
        console.warn('Invalid Reddit post data:', validation.errors);
        return null;
      }

      // 清理和标准化数据
      return this.clean(apiPost);
    } catch (error) {
      console.error('Error converting Reddit API post:', error);
      return null;
    }
  }

  /**
   * 批量转换Reddit API响应
   */
  static fromRedditAPIBatch(apiPosts: any[]): RedditPost[] {
    const validPosts: RedditPost[] = [];

    for (const apiPost of apiPosts) {
      const post = this.fromRedditAPI(apiPost);
      if (post) {
        validPosts.push(post);
      }
    }

    return validPosts;
  }

  /**
   * 检查帖子是否满足基础质量要求
   */
  static meetsBasicQuality(post: RedditPost): boolean {
    // 标题长度检查
    if (post.title.length < 10) {
      return false;
    }

    // 检查是否为删除的帖子
    if (post.title.toLowerCase().includes('[deleted]') || 
        post.title.toLowerCase().includes('[removed]')) {
      return false;
    }

    // 检查作者是否有效
    if (!post.author || post.author === '[deleted]') {
      return false;
    }

    return true;
  }

  /**
   * 计算帖子的热度分数
   */
  static calculateHeatScore(post: RedditPost): number {
    let score = 0;

    // 点赞数评分 (最高40分)
    score += Math.min(40, Math.log10(Math.max(1, post.score)) * 10);

    // 评论数评分 (最高30分)
    score += Math.min(30, Math.log10(Math.max(1, post.num_comments)) * 12);

    // 点赞率评分 (最高20分)
    if (post.upvote_ratio) {
      score += post.upvote_ratio * 20;
    }

    // 时间衰减 (最高10分)
    const now = Math.floor(Date.now() / 1000);
    const ageHours = (now - post.created_utc) / 3600;
    const timeScore = Math.max(0, 10 - (ageHours / 24)); // 24小时后开始衰减
    score += timeScore;

    return Math.round(score);
  }

  /**
   * 获取帖子的完整URL
   */
  static getFullUrl(post: RedditPost): string {
    if (post.url && post.url.startsWith('http')) {
      return post.url;
    }
    return `https://www.reddit.com/r/${post.subreddit}/comments/${post.id}/`;
  }

  /**
   * 获取帖子的简短描述
   */
  static getDescription(post: RedditPost, maxLength: number = 200): string {
    const content = post.selftext || post.title;
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength - 3) + '...';
  }

  /**
   * 检查两个帖子是否为重复内容
   */
  static isDuplicate(post1: RedditPost, post2: RedditPost): boolean {
    // ID相同
    if (post1.id === post2.id) {
      return true;
    }

    // 标题相似度检查（简单版本）
    const title1 = post1.title.toLowerCase().trim();
    const title2 = post2.title.toLowerCase().trim();
    
    if (title1 === title2) {
      return true;
    }

    // URL相同（如果都有URL）
    if (post1.url && post2.url && post1.url === post2.url) {
      return true;
    }

    return false;
  }

  /**
   * 获取帖子的摘要信息
   */
  static getSummary(post: RedditPost): {
    id: string;
    subreddit: string;
    title: string;
    score: number;
    comments: number;
    upvoteRatio: number | null;
    age: string;
    url: string;
  } {
    const now = Math.floor(Date.now() / 1000);
    const ageHours = Math.floor((now - post.created_utc) / 3600);
    
    let ageText: string;
    if (ageHours < 1) {
      ageText = '< 1h';
    } else if (ageHours < 24) {
      ageText = `${ageHours}h`;
    } else {
      const ageDays = Math.floor(ageHours / 24);
      ageText = `${ageDays}d`;
    }

    return {
      id: post.id,
      subreddit: post.subreddit,
      title: post.title.length > 100 ? post.title.substring(0, 97) + '...' : post.title,
      score: post.score,
      comments: post.num_comments,
      upvoteRatio: post.upvote_ratio,
      age: ageText,
      url: this.getFullUrl(post)
    };
  }
}
