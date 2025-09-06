-- Reddit AI 数据库查询 - 北京时间格式
-- 所有时间戳自动转换为北京时间 (+8小时)

-- 1. 查看今日采集的所有帖子 (北京时间)
SELECT 
    id,
    title,
    subreddit,
    score,
    num_comments,
    datetime(created_utc, 'unixepoch', '+8 hours') as 发布时间_北京,
    datetime(crawl_timestamp, 'unixepoch', '+8 hours') as 采集时间_北京,
    ai_category as AI分类,
    crawl_date as 采集日期
FROM reddit_ai_posts 
WHERE crawl_date = date('now', '+8 hours')
ORDER BY score DESC;

-- 2. 查看最新10条帖子 (北京时间)
SELECT 
    subreddit as 社区,
    title as 标题,
    score as 评分,
    num_comments as 评论数,
    datetime(created_utc, 'unixepoch', '+8 hours') as 发布时间_北京,
    ai_category as AI分类
FROM reddit_ai_posts 
ORDER BY created_utc DESC 
LIMIT 10;

-- 3. 查看评分最高的10条帖子 (北京时间)
SELECT 
    subreddit as 社区,
    title as 标题,
    score as 评分,
    num_comments as 评论数,
    datetime(created_utc, 'unixepoch', '+8 hours') as 发布时间_北京,
    ai_category as AI分类
FROM reddit_ai_posts 
ORDER BY score DESC 
LIMIT 10;

-- 4. 按社区统计帖子数量和平均评分
SELECT 
    subreddit as 社区,
    COUNT(*) as 帖子总数,
    ROUND(AVG(score), 1) as 平均评分,
    MAX(score) as 最高评分,
    datetime(MAX(created_utc), 'unixepoch', '+8 hours') as 最新帖子时间_北京
FROM reddit_ai_posts 
GROUP BY subreddit 
ORDER BY 帖子总数 DESC;

-- 5. 按日期统计每日采集量
SELECT 
    crawl_date as 采集日期,
    COUNT(*) as 每日采集量,
    ROUND(AVG(score), 1) as 平均评分,
    MAX(score) as 最高评分
FROM reddit_ai_posts 
GROUP BY crawl_date 
ORDER BY crawl_date DESC;

-- 6. 查看指定日期范围的数据 (北京时间)
-- 示例：查看最近3天的数据
SELECT 
    crawl_date as 采集日期,
    subreddit as 社区,
    title as 标题,
    score as 评分,
    datetime(created_utc, 'unixepoch', '+8 hours') as 发布时间_北京,
    ai_category as AI分类
FROM reddit_ai_posts 
WHERE crawl_date >= date('now', '+8 hours', '-3 days')
ORDER BY crawl_date DESC, score DESC;

-- 7. 查看特定社区的帖子 (北京时间)
-- 示例：查看 ChatGPT 社区的帖子
SELECT 
    title as 标题,
    score as 评分,
    num_comments as 评论数,
    datetime(created_utc, 'unixepoch', '+8 hours') as 发布时间_北京,
    crawl_date as 采集日期,
    ai_category as AI分类
FROM reddit_ai_posts 
WHERE subreddit = 'ChatGPT'
ORDER BY score DESC;

-- 8. 查看AI分类统计
SELECT 
    ai_category as AI分类,
    COUNT(*) as 帖子数量,
    ROUND(AVG(score), 1) as 平均评分,
    datetime(MAX(created_utc), 'unixepoch', '+8 hours') as 最新帖子时间_北京
FROM reddit_ai_posts 
WHERE ai_category IS NOT NULL
GROUP BY ai_category 
ORDER BY 帖子数量 DESC;

-- 9. 查看完整统计信息 (北京时间)
SELECT 
    '总帖子数' as 统计项,
    COUNT(*) as 数值,
    '' as 单位
FROM reddit_ai_posts
UNION ALL
SELECT 
    '今日采集量' as 统计项,
    COUNT(*) as 数值,
    '条' as 单位
FROM reddit_ai_posts 
WHERE crawl_date = date('now', '+8 hours')
UNION ALL
SELECT 
    '平均评分' as 统计项,
    ROUND(AVG(score), 1) as 数值,
    '分' as 单位
FROM reddit_ai_posts
UNION ALL
SELECT 
    '最高评分' as 统计项,
    MAX(score) as 数值,
    '分' as 单位
FROM reddit_ai_posts;

-- 10. 查看帖子详细信息 (北京时间)
-- 包含完整的时间信息
SELECT 
    id,
    title as 标题,
    subreddit as 社区,
    author as 作者,
    score as 评分,
    num_comments as 评论数,
    upvote_ratio as 支持率,
    datetime(created_utc, 'unixepoch', '+8 hours') as 发布时间_北京,
    datetime(crawl_timestamp, 'unixepoch', '+8 hours') as 采集时间_北京,
    crawl_date as 采集日期,
    ai_category as AI分类,
    quality_score as 质量评分,
    url as 链接
FROM reddit_ai_posts 
ORDER BY crawl_timestamp DESC 
LIMIT 5;

-- 11. 查看时间范围统计 (北京时间)
SELECT 
    '数据时间范围' as 信息类型,
    datetime(MIN(created_utc), 'unixepoch', '+8 hours') as 最早帖子_北京时间,
    datetime(MAX(created_utc), 'unixepoch', '+8 hours') as 最新帖子_北京时间,
    datetime(MIN(crawl_timestamp), 'unixepoch', '+8 hours') as 最早采集_北京时间,
    datetime(MAX(crawl_timestamp), 'unixepoch', '+8 hours') as 最新采集_北京时间
FROM reddit_ai_posts;

-- 12. 查看每小时发布分布 (北京时间)
SELECT 
    CAST(strftime('%H', datetime(created_utc, 'unixepoch', '+8 hours')) AS INTEGER) as 北京时间_小时,
    COUNT(*) as 帖子数量,
    ROUND(AVG(score), 1) as 平均评分
FROM reddit_ai_posts 
GROUP BY 北京时间_小时
ORDER BY 北京时间_小时;

-- 使用说明：
-- 1. 在 Cloudflare D1 控制台中执行这些查询
-- 2. 所有时间字段自动转换为北京时间 (+8小时)
-- 3. 可以修改查询条件来获取特定的数据
-- 4. 日期格式为 YYYY-MM-DD，时间格式为 YYYY-MM-DD HH:MM:SS
