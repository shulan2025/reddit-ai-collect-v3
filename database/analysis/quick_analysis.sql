-- =========================================
-- Reddit AI Collect v3.0 快速数据分析
-- 核心统计查询集合
-- =========================================

-- 1. 数据总览
SELECT 
    '数据总览' as 分析类型,
    COUNT(*) as 总帖子数,
    COUNT(DISTINCT subreddit) as 覆盖社区数,
    COUNT(DISTINCT author) as 独特作者数,
    COUNT(DISTINCT collection_date) as 采集天数,
    MIN(collection_date) as 最早采集日期,
    MAX(collection_date) as 最新采集日期
FROM redditV2_posts;

-- 2. 最新一天的数据统计
SELECT 
    '最新采集日统计' as 分析类型,
    collection_date as 采集日期,
    COUNT(*) as 帖子数量,
    COUNT(DISTINCT subreddit) as 社区数量,
    AVG(score) as 平均分数,
    AVG(num_comments) as 平均评论数,
    COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) as AI相关帖子数,
    ROUND(COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) * 100.0 / COUNT(*), 2) as AI相关比例
FROM redditV2_posts 
WHERE collection_date = (SELECT MAX(collection_date) FROM redditV2_posts);

-- 3. 社区排名 TOP 10
SELECT 
    subreddit as 社区名称,
    COUNT(*) as 帖子总数,
    AVG(score) as 平均分数,
    AVG(num_comments) as 平均评论数,
    MAX(score) as 最高分数,
    COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) as AI相关数
FROM redditV2_posts 
GROUP BY subreddit 
ORDER BY COUNT(*) DESC 
LIMIT 10;

-- 4. 数据质量统计
SELECT 
    '数据质量' as 分析类型,
    COUNT(*) as 总记录数,
    COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as 有标题数,
    COUNT(CASE WHEN post_url IS NOT NULL AND post_url != '' THEN 1 END) as 有帖子链接数,
    COUNT(CASE WHEN author IS NOT NULL AND author != '[deleted]' THEN 1 END) as 有效作者数,
    ROUND(COUNT(CASE WHEN post_url IS NOT NULL AND post_url != '' THEN 1 END) * 100.0 / COUNT(*), 2) as 链接完整率
FROM redditV2_posts;

-- 5. 分数和评论分布
SELECT 
    CASE 
        WHEN score < 10 THEN '低分 (< 10)'
        WHEN score < 50 THEN '中分 (10-49)'
        WHEN score < 100 THEN '高分 (50-99)'
        ELSE '超高分 (100+)'
    END as 分数段,
    COUNT(*) as 数量,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM redditV2_posts), 2) as 占比,
    AVG(num_comments) as 平均评论数
FROM redditV2_posts 
GROUP BY 
    CASE 
        WHEN score < 10 THEN '低分 (< 10)'
        WHEN score < 50 THEN '中分 (10-49)'
        WHEN score < 100 THEN '高分 (50-99)'
        ELSE '超高分 (100+)'
    END
ORDER BY MIN(score);

-- 6. 热门帖子 TOP 10
SELECT 
    subreddit as 社区,
    LEFT(title, 60) as 标题,
    score as 分数,
    num_comments as 评论数,
    is_ai_related as AI相关,
    collection_date as 采集日期
FROM redditV2_posts 
ORDER BY score DESC 
LIMIT 10;

-- 7. AI相关性统计
SELECT 
    'AI相关性统计' as 分析类型,
    COUNT(*) as 总帖子数,
    COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) as AI相关帖子数,
    ROUND(COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) * 100.0 / COUNT(*), 2) as AI相关比例,
    AVG(CASE WHEN is_ai_related = TRUE THEN score END) as AI帖子平均分数,
    AVG(CASE WHEN is_ai_related = TRUE THEN num_comments END) as AI帖子平均评论数
FROM redditV2_posts;

-- 8. 每日采集趋势
SELECT 
    collection_date as 采集日期,
    COUNT(*) as 帖子数量,
    AVG(score) as 平均分数,
    COUNT(CASE WHEN score >= 50 THEN 1 END) as 高分帖子数,
    COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) as AI相关数
FROM redditV2_posts 
GROUP BY collection_date 
ORDER BY collection_date DESC 
LIMIT 7;
