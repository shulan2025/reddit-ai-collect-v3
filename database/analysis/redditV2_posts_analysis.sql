-- =========================================
-- Reddit AI Collect v3.0 数据分析SQL
-- 表: redditV2_posts 
-- 生成时间: 2024-09-25
-- =========================================

-- ===========================================
-- 1. 基础数据统计
-- ===========================================

-- 1.1 总体数据概览
SELECT 
    '总体概览' as 分析类型,
    COUNT(*) as 总帖子数,
    COUNT(DISTINCT subreddit) as 覆盖社区数,
    COUNT(DISTINCT author) as 独特作者数,
    COUNT(DISTINCT collection_date) as 采集天数,
    MIN(collection_date) as 最早采集日期,
    MAX(collection_date) as 最新采集日期,
    COUNT(DISTINCT collection_batch_id) as 总批次数
FROM redditV2_posts;

-- 1.2 数据质量统计
SELECT 
    '数据质量' as 分析类型,
    COUNT(*) as 总记录数,
    COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as 有标题数,
    COUNT(CASE WHEN selftext IS NOT NULL AND selftext != '' THEN 1 END) as 有正文数,
    COUNT(CASE WHEN author IS NOT NULL AND author != '[deleted]' THEN 1 END) as 有效作者数,
    COUNT(CASE WHEN url IS NOT NULL AND url != '' THEN 1 END) as 有原始链接数,
    COUNT(CASE WHEN post_url IS NOT NULL AND post_url != '' THEN 1 END) as 有帖子链接数,
    ROUND(COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) * 100.0 / COUNT(*), 2) as 标题完整率,
    ROUND(COUNT(CASE WHEN post_url IS NOT NULL AND post_url != '' THEN 1 END) * 100.0 / COUNT(*), 2) as 帖子链接完整率
FROM redditV2_posts;

-- ===========================================
-- 2. 时间分析
-- ===========================================

-- 2.1 每日采集统计
SELECT 
    collection_date as 采集日期,
    COUNT(*) as 帖子数量,
    COUNT(DISTINCT subreddit) as 社区数量,
    COUNT(DISTINCT collection_batch_id) as 批次数量,
    AVG(score) as 平均分数,
    AVG(num_comments) as 平均评论数,
    AVG(upvote_ratio) as 平均点赞率,
    COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) as AI相关帖子数,
    ROUND(COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) * 100.0 / COUNT(*), 2) as AI相关比例
FROM redditV2_posts 
GROUP BY collection_date 
ORDER BY collection_date DESC;

-- 2.2 每小时采集分布（基于创建时间）
SELECT 
    strftime('%H', datetime(created_utc, 'unixepoch')) as 小时,
    COUNT(*) as 帖子数量,
    AVG(score) as 平均分数,
    AVG(num_comments) as 平均评论数
FROM redditV2_posts 
GROUP BY strftime('%H', datetime(created_utc, 'unixepoch'))
ORDER BY 小时;

-- 2.3 帖子年龄分析（采集时的帖子年龄）
SELECT 
    CASE 
        WHEN (collected_at - created_utc) / 3600 < 1 THEN '< 1小时'
        WHEN (collected_at - created_utc) / 3600 < 6 THEN '1-6小时'
        WHEN (collected_at - created_utc) / 3600 < 24 THEN '6-24小时'
        WHEN (collected_at - created_utc) / 86400 < 7 THEN '1-7天'
        WHEN (collected_at - created_utc) / 86400 < 30 THEN '7-30天'
        ELSE '> 30天'
    END as 帖子年龄段,
    COUNT(*) as 数量,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM redditV2_posts), 2) as 占比,
    AVG(score) as 平均分数,
    AVG(num_comments) as 平均评论数
FROM redditV2_posts 
GROUP BY 
    CASE 
        WHEN (collected_at - created_utc) / 3600 < 1 THEN '< 1小时'
        WHEN (collected_at - created_utc) / 3600 < 6 THEN '1-6小时'
        WHEN (collected_at - created_utc) / 3600 < 24 THEN '6-24小时'
        WHEN (collected_at - created_utc) / 86400 < 7 THEN '1-7天'
        WHEN (collected_at - created_utc) / 86400 < 30 THEN '7-30天'
        ELSE '> 30天'
    END
ORDER BY MIN((collected_at - created_utc));

-- ===========================================
-- 3. 社区分析
-- ===========================================

-- 3.1 社区帖子数量排名
SELECT 
    subreddit as 社区名称,
    COUNT(*) as 帖子总数,
    COUNT(DISTINCT collection_date) as 采集天数,
    ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT collection_date), 2) as 日均帖子数,
    AVG(score) as 平均分数,
    AVG(num_comments) as 平均评论数,
    AVG(upvote_ratio) as 平均点赞率,
    COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) as AI相关数,
    ROUND(COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) * 100.0 / COUNT(*), 2) as AI相关比例,
    MAX(score) as 最高分数,
    MAX(num_comments) as 最多评论数
FROM redditV2_posts 
GROUP BY subreddit 
ORDER BY COUNT(*) DESC;

-- 3.2 社区质量分析
SELECT 
    subreddit as 社区名称,
    COUNT(*) as 帖子数,
    AVG(score) as 平均分数,
    MEDIAN(score) as 中位分数,
    AVG(num_comments) as 平均评论数,
    MEDIAN(num_comments) as 中位评论数,
    AVG(upvote_ratio) as 平均点赞率,
    COUNT(CASE WHEN score >= 50 THEN 1 END) as 高分帖子数,
    COUNT(CASE WHEN num_comments >= 20 THEN 1 END) as 高讨论帖子数,
    ROUND(COUNT(CASE WHEN score >= 50 THEN 1 END) * 100.0 / COUNT(*), 2) as 高分比例,
    ROUND(COUNT(CASE WHEN num_comments >= 20 THEN 1 END) * 100.0 / COUNT(*), 2) as 高讨论比例
FROM redditV2_posts 
GROUP BY subreddit 
HAVING COUNT(*) >= 10  -- 只显示至少有10个帖子的社区
ORDER BY AVG(score) DESC;

-- ===========================================
-- 4. 内容分析
-- ===========================================

-- 4.1 帖子类型分析
SELECT 
    '帖子类型分析' as 分析类型,
    COUNT(CASE WHEN is_self = TRUE THEN 1 END) as 文本帖数量,
    COUNT(CASE WHEN is_video = TRUE THEN 1 END) as 视频帖数量,
    COUNT(CASE WHEN is_self = FALSE AND is_video = FALSE THEN 1 END) as 链接帖数量,
    ROUND(COUNT(CASE WHEN is_self = TRUE THEN 1 END) * 100.0 / COUNT(*), 2) as 文本帖比例,
    ROUND(COUNT(CASE WHEN is_video = TRUE THEN 1 END) * 100.0 / COUNT(*), 2) as 视频帖比例,
    ROUND(COUNT(CASE WHEN is_self = FALSE AND is_video = FALSE THEN 1 END) * 100.0 / COUNT(*), 2) as 链接帖比例
FROM redditV2_posts;

-- 4.2 标题长度分析
SELECT 
    CASE 
        WHEN LENGTH(title) < 50 THEN '短标题 (< 50字符)'
        WHEN LENGTH(title) < 100 THEN '中标题 (50-100字符)'
        WHEN LENGTH(title) < 200 THEN '长标题 (100-200字符)'
        ELSE '超长标题 (> 200字符)'
    END as 标题长度段,
    COUNT(*) as 数量,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM redditV2_posts), 2) as 占比,
    AVG(score) as 平均分数,
    AVG(num_comments) as 平均评论数
FROM redditV2_posts 
GROUP BY 
    CASE 
        WHEN LENGTH(title) < 50 THEN '短标题 (< 50字符)'
        WHEN LENGTH(title) < 100 THEN '中标题 (50-100字符)'
        WHEN LENGTH(title) < 200 THEN '长标题 (100-200字符)'
        ELSE '超长标题 (> 200字符)'
    END
ORDER BY AVG(score) DESC;

-- 4.3 正文长度分析
SELECT 
    CASE 
        WHEN selftext IS NULL OR selftext = '' THEN '无正文'
        WHEN LENGTH(selftext) < 100 THEN '短正文 (< 100字符)'
        WHEN LENGTH(selftext) < 500 THEN '中正文 (100-500字符)'
        WHEN LENGTH(selftext) < 2000 THEN '长正文 (500-2000字符)'
        ELSE '超长正文 (> 2000字符)'
    END as 正文长度段,
    COUNT(*) as 数量,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM redditV2_posts), 2) as 占比,
    AVG(score) as 平均分数,
    AVG(num_comments) as 平均评论数
FROM redditV2_posts 
GROUP BY 
    CASE 
        WHEN selftext IS NULL OR selftext = '' THEN '无正文'
        WHEN LENGTH(selftext) < 100 THEN '短正文 (< 100字符)'
        WHEN LENGTH(selftext) < 500 THEN '中正文 (100-500字符)'
        WHEN LENGTH(selftext) < 2000 THEN '长正文 (500-2000字符)'
        ELSE '超长正文 (> 2000字符)'
    END
ORDER BY AVG(score) DESC;

-- ===========================================
-- 5. 互动数据分析
-- ===========================================

-- 5.1 分数分布分析
SELECT 
    CASE 
        WHEN score < 0 THEN '负分'
        WHEN score = 0 THEN '零分'
        WHEN score < 10 THEN '1-9分'
        WHEN score < 50 THEN '10-49分'
        WHEN score < 100 THEN '50-99分'
        WHEN score < 500 THEN '100-499分'
        WHEN score < 1000 THEN '500-999分'
        ELSE '1000+分'
    END as 分数段,
    COUNT(*) as 数量,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM redditV2_posts), 2) as 占比,
    AVG(num_comments) as 平均评论数,
    AVG(upvote_ratio) as 平均点赞率
FROM redditV2_posts 
GROUP BY 
    CASE 
        WHEN score < 0 THEN '负分'
        WHEN score = 0 THEN '零分'
        WHEN score < 10 THEN '1-9分'
        WHEN score < 50 THEN '10-49分'
        WHEN score < 100 THEN '50-99分'
        WHEN score < 500 THEN '100-499分'
        WHEN score < 1000 THEN '500-999分'
        ELSE '1000+分'
    END
ORDER BY MIN(score);

-- 5.2 评论数分布分析
SELECT 
    CASE 
        WHEN num_comments = 0 THEN '无评论'
        WHEN num_comments < 5 THEN '1-4评论'
        WHEN num_comments < 10 THEN '5-9评论'
        WHEN num_comments < 20 THEN '10-19评论'
        WHEN num_comments < 50 THEN '20-49评论'
        WHEN num_comments < 100 THEN '50-99评论'
        ELSE '100+评论'
    END as 评论数段,
    COUNT(*) as 数量,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM redditV2_posts), 2) as 占比,
    AVG(score) as 平均分数,
    AVG(upvote_ratio) as 平均点赞率
FROM redditV2_posts 
GROUP BY 
    CASE 
        WHEN num_comments = 0 THEN '无评论'
        WHEN num_comments < 5 THEN '1-4评论'
        WHEN num_comments < 10 THEN '5-9评论'
        WHEN num_comments < 20 THEN '10-19评论'
        WHEN num_comments < 50 THEN '20-49评论'
        WHEN num_comments < 100 THEN '50-99评论'
        ELSE '100+评论'
    END
ORDER BY MIN(num_comments);

-- 5.3 点赞率分析
SELECT 
    CASE 
        WHEN upvote_ratio < 0.5 THEN '低点赞率 (< 50%)'
        WHEN upvote_ratio < 0.7 THEN '中点赞率 (50-70%)'
        WHEN upvote_ratio < 0.9 THEN '高点赞率 (70-90%)'
        ELSE '极高点赞率 (> 90%)'
    END as 点赞率段,
    COUNT(*) as 数量,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM redditV2_posts), 2) as 占比,
    AVG(score) as 平均分数,
    AVG(num_comments) as 平均评论数,
    AVG(upvote_ratio) as 平均点赞率
FROM redditV2_posts 
WHERE upvote_ratio IS NOT NULL
GROUP BY 
    CASE 
        WHEN upvote_ratio < 0.5 THEN '低点赞率 (< 50%)'
        WHEN upvote_ratio < 0.7 THEN '中点赞率 (50-70%)'
        WHEN upvote_ratio < 0.9 THEN '高点赞率 (70-90%)'
        ELSE '极高点赞率 (> 90%)'
    END
ORDER BY MIN(upvote_ratio);

-- ===========================================
-- 6. AI相关性分析
-- ===========================================

-- 6.1 AI相关性统计
SELECT 
    'AI相关性统计' as 分析类型,
    COUNT(*) as 总帖子数,
    COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) as AI相关帖子数,
    COUNT(CASE WHEN is_ai_related = FALSE THEN 1 END) as 非AI相关帖子数,
    ROUND(COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) * 100.0 / COUNT(*), 2) as AI相关比例,
    AVG(CASE WHEN is_ai_related = TRUE THEN ai_relevance_score END) as AI帖子平均相关性分数,
    AVG(CASE WHEN is_ai_related = TRUE THEN score END) as AI帖子平均分数,
    AVG(CASE WHEN is_ai_related = TRUE THEN num_comments END) as AI帖子平均评论数
FROM redditV2_posts;

-- 6.2 AI相关性分数分布
SELECT 
    CASE 
        WHEN ai_relevance_score = 0 THEN '无相关性 (0)'
        WHEN ai_relevance_score < 0.3 THEN '低相关性 (0-0.3)'
        WHEN ai_relevance_score < 0.6 THEN '中相关性 (0.3-0.6)'
        WHEN ai_relevance_score < 0.8 THEN '高相关性 (0.6-0.8)'
        ELSE '极高相关性 (0.8-1.0)'
    END as AI相关性段,
    COUNT(*) as 数量,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM redditV2_posts), 2) as 占比,
    AVG(score) as 平均分数,
    AVG(num_comments) as 平均评论数
FROM redditV2_posts 
GROUP BY 
    CASE 
        WHEN ai_relevance_score = 0 THEN '无相关性 (0)'
        WHEN ai_relevance_score < 0.3 THEN '低相关性 (0-0.3)'
        WHEN ai_relevance_score < 0.6 THEN '中相关性 (0.3-0.6)'
        WHEN ai_relevance_score < 0.8 THEN '高相关性 (0.6-0.8)'
        ELSE '极高相关性 (0.8-1.0)'
    END
ORDER BY MIN(ai_relevance_score);

-- ===========================================
-- 7. 作者分析
-- ===========================================

-- 7.1 活跃作者统计
SELECT 
    author as 作者,
    COUNT(*) as 帖子数量,
    COUNT(DISTINCT subreddit) as 发帖社区数,
    AVG(score) as 平均分数,
    AVG(num_comments) as 平均评论数,
    MAX(score) as 最高分数,
    SUM(score) as 总分数,
    COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) as AI相关帖子数
FROM redditV2_posts 
WHERE author IS NOT NULL AND author != '[deleted]' AND author != 'AutoModerator'
GROUP BY author 
HAVING COUNT(*) >= 3  -- 至少发布3个帖子
ORDER BY COUNT(*) DESC
LIMIT 20;

-- 7.2 删除/无效作者统计
SELECT 
    '作者状态统计' as 分析类型,
    COUNT(CASE WHEN author IS NULL THEN 1 END) as 空作者数,
    COUNT(CASE WHEN author = '[deleted]' THEN 1 END) as 已删除作者数,
    COUNT(CASE WHEN author = 'AutoModerator' THEN 1 END) as 自动机器人数,
    COUNT(CASE WHEN author IS NOT NULL AND author != '[deleted]' AND author != 'AutoModerator' THEN 1 END) as 有效作者帖子数,
    ROUND(COUNT(CASE WHEN author IS NOT NULL AND author != '[deleted]' AND author != 'AutoModerator' THEN 1 END) * 100.0 / COUNT(*), 2) as 有效作者比例
FROM redditV2_posts;

-- ===========================================
-- 8. 热门内容分析
-- ===========================================

-- 8.1 高分帖子 (Top 20)
SELECT 
    subreddit as 社区,
    title as 标题,
    author as 作者,
    score as 分数,
    num_comments as 评论数,
    upvote_ratio as 点赞率,
    is_ai_related as AI相关,
    collection_date as 采集日期,
    substr(post_url, 1, 50) || '...' as 帖子链接
FROM redditV2_posts 
ORDER BY score DESC 
LIMIT 20;

-- 8.2 高讨论帖子 (Top 20)
SELECT 
    subreddit as 社区,
    title as 标题,
    author as 作者,
    score as 分数,
    num_comments as 评论数,
    upvote_ratio as 点赞率,
    is_ai_related as AI相关,
    collection_date as 采集日期,
    substr(post_url, 1, 50) || '...' as 帖子链接
FROM redditV2_posts 
ORDER BY num_comments DESC 
LIMIT 20;

-- 8.3 综合热度排名 (分数 × 评论数)
SELECT 
    subreddit as 社区,
    title as 标题,
    author as 作者,
    score as 分数,
    num_comments as 评论数,
    (score * num_comments) as 综合热度,
    upvote_ratio as 点赞率,
    is_ai_related as AI相关,
    collection_date as 采集日期
FROM redditV2_posts 
WHERE score > 0 AND num_comments > 0
ORDER BY (score * num_comments) DESC 
LIMIT 20;

-- ===========================================
-- 9. 数据质量检查
-- ===========================================

-- 9.1 异常数据检测
SELECT 
    '异常数据检测' as 检查类型,
    COUNT(CASE WHEN score < 0 THEN 1 END) as 负分帖子数,
    COUNT(CASE WHEN upvote_ratio < 0 OR upvote_ratio > 1 THEN 1 END) as 异常点赞率数,
    COUNT(CASE WHEN created_utc > collected_at THEN 1 END) as 时间异常数,
    COUNT(CASE WHEN LENGTH(title) < 5 THEN 1 END) as 标题过短数,
    COUNT(CASE WHEN LENGTH(title) > 300 THEN 1 END) as 标题过长数,
    COUNT(CASE WHEN url IS NULL AND post_url IS NULL THEN 1 END) as 无链接数
FROM redditV2_posts;

-- 9.2 重复数据检查
SELECT 
    '重复数据检查' as 检查类型,
    COUNT(*) as 总记录数,
    COUNT(DISTINCT id) as 唯一ID数,
    COUNT(*) - COUNT(DISTINCT id) as 重复ID数,
    COUNT(DISTINCT title || subreddit) as 唯一标题社区组合数,
    COUNT(*) - COUNT(DISTINCT title || subreddit) as 可能重复帖子数
FROM redditV2_posts;

-- ===========================================
-- 10. 趋势分析
-- ===========================================

-- 10.1 每日数据趋势
SELECT 
    collection_date as 日期,
    COUNT(*) as 帖子数,
    AVG(score) as 平均分数,
    AVG(num_comments) as 平均评论数,
    COUNT(CASE WHEN score >= 100 THEN 1 END) as 高分帖子数,
    COUNT(CASE WHEN num_comments >= 50 THEN 1 END) as 高讨论帖子数,
    COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) as AI相关数,
    LAG(COUNT(*), 1) OVER (ORDER BY collection_date) as 前一天帖子数,
    COUNT(*) - LAG(COUNT(*), 1) OVER (ORDER BY collection_date) as 数量变化
FROM redditV2_posts 
GROUP BY collection_date 
ORDER BY collection_date;

-- ===========================================
-- 结束标记
-- ===========================================
SELECT '=== Reddit AI Collect v3.0 数据分析完成 ===' as 完成状态;
