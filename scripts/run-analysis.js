#!/usr/bin/env node

/**
 * Reddit AI Collect v3.0 数据分析执行脚本
 * 执行 redditV2_posts 表的全面数据分析
 */

const fs = require('fs');
const path = require('path');

// Cloudflare 配置
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'WLzJ5DaoyobRPli3uwKcdLZkNrzzwfGGQIjbMsqU';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'e23dc8a212c55fe9210b99f24be11eb9';
const CLOUDFLARE_D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID || '3d1a2cff-14ac-49e7-9bfd-b4a5606c9712';

class DataAnalyzer {
    constructor() {
        this.apiUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;
        this.headers = {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
        };
        
        // 读取分析SQL文件
        this.analysisSQL = this.loadAnalysisSQL();
    }

    loadAnalysisSQL() {
        const sqlFile = path.join(__dirname, '../database/analysis/redditV2_posts_analysis.sql');
        if (!fs.existsSync(sqlFile)) {
            throw new Error(`分析SQL文件不存在: ${sqlFile}`);
        }
        return fs.readFileSync(sqlFile, 'utf8');
    }

    // 将SQL按注释分割成独立查询
    splitSQLQueries(sql) {
        const queries = [];
        const lines = sql.split('\n');
        let currentQuery = '';
        let currentTitle = '';
        
        for (const line of lines) {
            if (line.trim().startsWith('--') && line.includes('=')) {
                // 这是一个标题行
                if (currentQuery.trim() && currentTitle) {
                    queries.push({
                        title: currentTitle,
                        sql: currentQuery.trim()
                    });
                }
                currentTitle = line.replace(/--/g, '').replace(/=/g, '').trim();
                currentQuery = '';
            } else if (line.trim().startsWith('SELECT')) {
                // 开始新的查询
                if (currentQuery.trim() && currentTitle) {
                    queries.push({
                        title: currentTitle,
                        sql: currentQuery.trim()
                    });
                }
                currentQuery = line + '\n';
            } else if (currentQuery && !line.trim().startsWith('--')) {
                currentQuery += line + '\n';
            }
        }
        
        // 添加最后一个查询
        if (currentQuery.trim() && currentTitle) {
            queries.push({
                title: currentTitle,
                sql: currentQuery.trim()
            });
        }
        
        return queries;
    }

    async executeQuery(sql) {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({ sql })
            });

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(`查询失败: ${JSON.stringify(data.errors)}`);
            }

            return data.result[0];
        } catch (error) {
            console.error(`查询执行失败:`, error);
            throw error;
        }
    }

    formatResults(results, title) {
        if (!results || !results.results || results.results.length === 0) {
            return `\n📊 ${title}\n${'='.repeat(50)}\n❌ 无数据\n`;
        }

        let output = `\n📊 ${title}\n${'='.repeat(50)}\n`;
        
        const columns = results.meta.columns;
        const rows = results.results;

        // 表头
        const header = columns.map(col => col.name).join(' | ');
        output += header + '\n';
        output += columns.map(() => '---').join(' | ') + '\n';

        // 数据行
        rows.forEach(row => {
            const rowData = columns.map(col => {
                const value = row[col.name];
                if (value === null || value === undefined) return 'NULL';
                if (typeof value === 'number') return value.toLocaleString();
                if (typeof value === 'string' && value.length > 50) return value.substring(0, 47) + '...';
                return value;
            }).join(' | ');
            output += rowData + '\n';
        });

        return output;
    }

    async runFullAnalysis() {
        console.log('🚀 开始执行 Reddit AI Collect v3.0 数据分析...');
        console.log(`⏰ 开始时间: ${new Date().toLocaleString()}`);
        
        const queries = this.splitSQLQueries(this.analysisSQL);
        console.log(`📋 总共 ${queries.length} 个分析查询`);
        
        let results = '';
        let successCount = 0;
        let errorCount = 0;

        // 添加分析报告头部
        results += `# Reddit AI Collect v3.0 数据分析报告\n`;
        results += `生成时间: ${new Date().toLocaleString()}\n`;
        results += `数据库: redditV2_posts\n`;
        results += `分析查询数: ${queries.length}\n`;
        results += `${'='.repeat(80)}\n`;

        for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            
            try {
                console.log(`\n📊 执行分析 ${i + 1}/${queries.length}: ${query.title}`);
                
                const result = await this.executeQuery(query.sql);
                results += this.formatResults(result, query.title);
                
                successCount++;
                console.log(`✅ 完成`);
                
                // 添加延迟避免API限制
                if (i < queries.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
            } catch (error) {
                console.error(`❌ 分析失败: ${query.title}`, error.message);
                results += `\n📊 ${query.title}\n${'='.repeat(50)}\n❌ 执行失败: ${error.message}\n`;
                errorCount++;
            }
        }

        // 保存结果到文件
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const outputFile = `database/analysis/analysis_report_${timestamp}.md`;
        
        results += `\n\n## 分析总结\n`;
        results += `- 总查询数: ${queries.length}\n`;
        results += `- 成功执行: ${successCount}\n`;
        results += `- 执行失败: ${errorCount}\n`;
        results += `- 成功率: ${(successCount / queries.length * 100).toFixed(1)}%\n`;
        results += `- 完成时间: ${new Date().toLocaleString()}\n`;

        fs.writeFileSync(outputFile, results, 'utf8');

        console.log(`\n🎉 数据分析完成!`);
        console.log(`📊 成功执行: ${successCount}/${queries.length} 个查询`);
        console.log(`📄 分析报告已保存: ${outputFile}`);
        console.log(`⏰ 完成时间: ${new Date().toLocaleString()}`);

        return {
            totalQueries: queries.length,
            successful: successCount,
            failed: errorCount,
            outputFile: outputFile
        };
    }

    async runQuickStats() {
        console.log('⚡ 执行快速统计分析...');
        
        const quickQueries = [
            {
                title: '数据总览',
                sql: `SELECT 
                    COUNT(*) as 总帖子数,
                    COUNT(DISTINCT subreddit) as 覆盖社区数,
                    COUNT(DISTINCT collection_date) as 采集天数,
                    MIN(collection_date) as 最早采集,
                    MAX(collection_date) as 最新采集
                FROM redditV2_posts`
            },
            {
                title: '今日统计',
                sql: `SELECT 
                    collection_date as 采集日期,
                    COUNT(*) as 帖子数量,
                    AVG(score) as 平均分数,
                    AVG(num_comments) as 平均评论数,
                    COUNT(CASE WHEN is_ai_related = TRUE THEN 1 END) as AI相关数
                FROM redditV2_posts 
                WHERE collection_date = (SELECT MAX(collection_date) FROM redditV2_posts)`
            },
            {
                title: '热门社区TOP5',
                sql: `SELECT 
                    subreddit as 社区,
                    COUNT(*) as 帖子数,
                    AVG(score) as 平均分数
                FROM redditV2_posts 
                GROUP BY subreddit 
                ORDER BY COUNT(*) DESC 
                LIMIT 5`
            }
        ];

        for (const query of quickQueries) {
            try {
                console.log(`\n📊 ${query.title}`);
                const result = await this.executeQuery(query.sql);
                console.log(this.formatResults(result, query.title));
            } catch (error) {
                console.error(`❌ ${query.title} 执行失败:`, error.message);
            }
        }
    }
}

// 主执行逻辑
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'full';

    try {
        const analyzer = new DataAnalyzer();

        switch (command) {
            case 'quick':
                await analyzer.runQuickStats();
                break;
            case 'full':
            default:
                await analyzer.runFullAnalysis();
                break;
        }

    } catch (error) {
        console.error('❌ 分析执行失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { DataAnalyzer };
