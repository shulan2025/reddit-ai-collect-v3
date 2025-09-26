-- =========================================
-- Reddit AI Collect v3.0 日常分析SQL
-- 用于每日快速数据检查
-- =========================================

-- 基础统计 - 一行显示所有关键指标
SELECT 
    COUNT(*) as 总帖子数,
    COUNT(DISTINCT subreddit) as 社区数,
    COUNT(DISTINCT collection_date) as 采集天数,
    AVG(score) as 平均分数,
    MAX(score) as 最高分数,
    COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) as AI相关数,
    ROUND(COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) * 100.0 / COUNT(*), 1) as AI相关率,
    ROUND(COUNT(CASE WHEN post_url IS NOT NULL AND post_url != '' THEN 1 END) * 100.0 / COUNT(*), 1) as 链接完整率
FROM redditV2_posts;

-- 今日TOP5社区
SELECT 
    subreddit as 社区,
    COUNT(*) as 帖子数,
    ROUND(AVG(score), 1) as 平均分数,
    MAX(score) as 最高分数
FROM redditV2_posts 
WHERE collection_date = (SELECT MAX(collection_date) FROM redditV2_posts)
GROUP BY subreddit 
ORDER BY COUNT(*) DESC 
LIMIT 5;

-- 今日热门帖子TOP5
SELECT 
    subreddit as 社区,
    SUBSTR(title, 1, 40) || '...' as 标题,
    score as 分数,
    num_comments as 评论
FROM redditV2_posts 
WHERE collection_date = (SELECT MAX(collection_date) FROM redditV2_posts)
ORDER BY score DESC 
LIMIT 5;
