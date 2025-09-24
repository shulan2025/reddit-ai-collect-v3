// Reddit AI爬虫类型定义

export interface Env {
  // Cloudflare绑定
  DB: D1Database;
  
  // 环境变量
  ENVIRONMENT: string;
  DAILY_LIMIT: string;
  MAX_POSTS_PER_REQUEST: string;
  MIN_UPVOTE_RATIO: string;
  API_REQUEST_INTERVAL: string;
  MAX_RETRIES: string;
  
  // 密钥
  REDDIT_CLIENT_ID: string;
  REDDIT_CLIENT_SECRET: string;
  REDDIT_USER_AGENT: string;
  GOOGLE_AI_API_KEY?: string;
}

// Reddit API相关类型
export interface RedditAPIResponse {
  kind: string;
  data: {
    modhash?: string;
    dist?: number;
    children: Array<{
      kind: string;
      data: any;
    }>;
    after?: string;
    before?: string;
  };
}

export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  url: string;
  created_utc: number;
  author: string;
  score: number;
  num_comments: number;
  upvote_ratio: number;
  ups: number;
  downs: number;
  flair?: string;
  awards?: any[];
  is_self: boolean;
  is_video: boolean;
  permalink: string;
  domain: string;
  thumbnail?: string;
  preview?: any;
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  parent_id: string;
  replies?: RedditComment[];
}

export interface RedditAPIResponse {
  data: {
    children: Array<{
      data: RedditPost;
    }>;
    after?: string;
    before?: string;
  };
}

// 数据库记录类型
export interface DBRedditPost {
  id: string;
  subreddit: string;
  title: string;
  selftext?: string;
  url: string;
  created_utc: number;
  collected_at: number;
  collection_date: string;
  collection_batch_id?: string;
  author?: string;
  author_karma?: number;
  author_created_utc?: number;
  score: number;
  num_comments: number;
  upvote_ratio: number;
  ups: number;
  downs: number;
  flair?: string;
  awards?: string; // JSON string
  is_self: boolean;
  is_video: boolean;
  top_comments?: string; // JSON string
  heat_score: number;
  quality_score: number;
  ai_relevance_score: number;
  is_ai_related: boolean;
  is_processed: boolean;
  processing_status: string;
  created_at: number;
  updated_at: number;
}

export interface SubredditConfig {
  subreddit_name: string;
  is_active: boolean;
  priority: number;
  daily_quota: number;
  min_score: number;
  min_comments: number;
  min_upvote_ratio: number;
  weight_multiplier: number;
  last_crawled?: number;
  total_collected: number;
  created_at: number;
  updated_at: number;
}

export interface CollectionStats {
  id?: number;
  collection_date: string;
  collection_batch_id: string;
  subreddit: string;
  total_fetched: number;
  total_filtered: number;
  total_saved: number;
  avg_score: number;
  avg_comments: number;
  avg_upvote_ratio: number;
  avg_heat_score: number;
  avg_quality_score: number;
  start_time: number;
  end_time?: number;
  duration_seconds?: number;
  status: 'running' | 'completed' | 'failed';
  error_message?: string;
  created_at: number;
}

export interface DailySummary {
  date: string;
  total_posts: number;
  ai_related_posts: number;
  avg_heat_score: number;
  avg_quality_score: number;
  top_subreddits: string; // JSON string
  top_posts: string; // JSON string
  collection_batches: number;
  total_errors: number;
  created_at: number;
  updated_at: number;
}

export interface ErrorLog {
  id?: number;
  error_type: string;
  error_message: string;
  error_details?: string; // JSON string
  subreddit?: string;
  post_id?: string;
  collection_batch_id?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  resolved: boolean;
  created_at: number;
}

// 配置类型
export interface SubredditConfigItem {
  name: string;
  weight: number;
  min_score: number;
  min_comments: number;
  min_upvote_ratio: number;
  daily_quota: number;
  description: string;
}

export interface SubredditTier {
  daily_quota: number;
  description: string;
  communities: SubredditConfigItem[];
}

export interface SubredditsConfig {
  subreddits: {
    tier1_high_priority: SubredditTier;
    tier2_medium_priority: SubredditTier;
    tier3_standard_priority: SubredditTier;
  };
  global_settings: {
    total_daily_limit: number;
    max_posts_per_request: number;
    request_interval_ms: number;
    max_retries: number;
    timeout_seconds: number;
    user_agent: string;
  };
}

export interface AIKeywords {
  high_relevance_keywords: string[];
  medium_relevance_keywords: string[];
  technology_keywords: string[];
  application_keywords: string[];
  research_keywords: string[];
  exclude_keywords: string[];
  scoring_weights: {
    high_relevance: number;
    medium_relevance: number;
    technology: number;
    application: number;
    research: number;
    exclude: number;
  };
}

// 过滤器类型
export interface PostFilter {
  minScore: number;
  minComments: number;
  minUpvoteRatio: number;
  maxAgeHours: number;
  minAgeMinutes: number;
  minTitleLength: number;
  minSelfTextLength: number;
  excludeDeletedUsers: boolean;
  excludeShadowBannedUsers: boolean;
  minAuthorKarma: number;
}

// 评分类型
export interface PostScores {
  heatScore: number;
  qualityScore: number;
  aiRelevanceScore: number;
}

// API响应类型
export interface CrawlerResponse {
  success: boolean;
  message: string;
  data?: {
    totalProcessed: number;
    totalSaved: number;
    batchId: string;
    duration: number;
    errors: number;
  };
  error?: string;
}

// 批次处理类型
export interface BatchProcessResult {
  batchId: string;
  subreddit: string;
  totalFetched: number;
  totalFiltered: number;
  totalSaved: number;
  errors: string[];
  duration: number;
}

// Reddit认证类型
export interface RedditAuth {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

// 工具函数类型
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}
