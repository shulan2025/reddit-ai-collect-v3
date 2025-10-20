// Reddit AI Collect v3.0 验证脚本
// 验证v3.0版本的完整性和功能正确性

const fs = require('fs');
const path = require('path');

class V3PackageVerifier {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.checks = 0;
    this.passed = 0;
  }

  check(condition, message, isWarning = false) {
    this.checks++;
    if (condition) {
      this.passed++;
      console.log(`✅ ${message}`);
    } else {
      if (isWarning) {
        this.warnings.push(message);
        console.log(`⚠️  ${message}`);
      } else {
        this.errors.push(message);
        console.log(`❌ ${message}`);
      }
    }
  }

  fileExists(filePath, description) {
    const exists = fs.existsSync(filePath);
    this.check(exists, `${description}: ${filePath}`);
    return exists;
  }

  verifyVersionInfo() {
    console.log('\n📦 验证v3.0版本信息...');
    
    if (!this.fileExists('package.json', 'package.json文件存在')) {
      return;
    }

    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    this.check(pkg.name === 'reddit-ai-collect_v3', 'package名称更新为v3');
    this.check(pkg.version === '3.0.0', 'package版本为3.0.0');
    this.check(pkg.description.includes('v3.0'), 'package描述包含v3.0');
    this.check(pkg.description.includes('URL字段'), 'package描述提及URL字段修复');
  }

  verifyDatabaseSchema() {
    console.log('\n🗄️ 验证数据库Schema更新...');
    
    if (this.fileExists('database/migrations/0001_initial_schema.sql', '初始数据库架构文件')) {
      const content = fs.readFileSync('database/migrations/0001_initial_schema.sql', 'utf8');
      this.check(content.includes('post_url TEXT'), '数据库schema包含post_url字段');
      this.check(content.includes('原始链接'), 'url字段注释已更新');
      this.check(content.includes('标准Reddit帖子链接'), 'post_url字段有正确注释');
    }
  }

  verifyScriptUpdates() {
    console.log('\n🔧 验证采集脚本更新...');
    
    const scripts = [
      ['scripts/incremental-crawl.js', '增量采集脚本'],
      ['scripts/full-crawl-2000.js', '完整采集脚本'],
      ['scripts/deep-test-crawl.js', '深度测试脚本']
    ];

    scripts.forEach(([file, desc]) => {
      if (this.fileExists(file, desc)) {
        const content = fs.readFileSync(file, 'utf8');
        this.check(content.includes('post_url:'), `${desc}包含post_url字段处理`);
        this.check(content.includes('permalink'), `${desc}使用permalink生成帖子URL`);
        this.check(content.includes('post_url,'), `${desc}的SQL语句包含post_url字段`);
      }
    });
  }

  verifyBugFixes() {
    console.log('\n🐛 验证Bug修复...');
    
    if (this.fileExists('scripts/deep-test-crawl.js', '深度测试脚本')) {
      const content = fs.readFileSync('scripts/deep-test-crawl.js', 'utf8');
      this.check(content.includes('this.testResults.apiStats'), '深度测试脚本修复了apiStats引用');
      this.check(!content.includes('this.apiStats'), '深度测试脚本移除了错误的apiStats引用');
    }
  }

  verifyDocumentation() {
    console.log('\n📚 验证v3.0文档...');
    
    const docs = [
      ['README.md', 'README文档'],
      ['CHANGELOG.md', '更新日志'],
      ['RELEASE_NOTES_v3.0.md', 'v3.0发布说明']
    ];

    docs.forEach(([file, desc]) => {
      if (this.fileExists(file, desc)) {
        const content = fs.readFileSync(file, 'utf8');
        this.check(content.includes('v3.0') || content.includes('3.0.0'), `${desc}包含v3.0版本信息`);
        this.check(content.includes('URL字段') || content.includes('post_url'), `${desc}提及URL字段修复`);
      }
    });
  }

  verifyUrlFieldHandling() {
    console.log('\n🔗 验证URL字段处理...');
    
    // 检查修复脚本
    this.fileExists('scripts/fix-url-field.js', 'URL字段修复脚本');
    this.fileExists('scripts/test-url-fix.js', 'URL修复测试脚本');
    
    // 检查增量采集脚本中的URL处理
    if (this.fileExists('scripts/incremental-crawl.js', '增量采集脚本')) {
      const content = fs.readFileSync('scripts/incremental-crawl.js', 'utf8');
      this.check(content.includes('// 原始URL'), '增量采集脚本有URL字段注释');
      this.check(content.includes('// 标准帖子URL'), '增量采集脚本有post_url字段注释');
    }
  }

  verifyBackwardCompatibility() {
    console.log('\n🔄 验证向后兼容性...');
    
    // 检查是否保留了原有的url字段处理
    const scripts = ['scripts/incremental-crawl.js', 'scripts/full-crawl-2000.js'];
    
    scripts.forEach(scriptPath => {
      if (fs.existsSync(scriptPath)) {
        const content = fs.readFileSync(scriptPath, 'utf8');
        this.check(content.includes('url: post.url'), `${scriptPath}保留原有url字段`);
        this.check(content.includes('post_url:'), `${scriptPath}新增post_url字段`);
      }
    });
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 Reddit AI Collect v3.0 验证报告');
    console.log('='.repeat(60));
    
    console.log(`\n📊 检查统计:`);
    console.log(`   总检查项: ${this.checks}`);
    console.log(`   通过检查: ${this.passed}`);
    console.log(`   失败检查: ${this.errors.length}`);
    console.log(`   警告项目: ${this.warnings.length}`);
    console.log(`   通过率: ${Math.round(this.passed/this.checks*100)}%`);

    if (this.errors.length > 0) {
      console.log(`\n❌ 发现 ${this.errors.length} 个错误:`);
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`\n⚠️  发现 ${this.warnings.length} 个警告:`);
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }

    console.log(`\n🎯 v3.0版本状态:`);
    if (this.errors.length === 0) {
      console.log(`   ✅ Reddit AI Collect v3.0 已准备完成!`);
      console.log(`   🔗 主要修复: URL字段问题和测试脚本bug`);
      console.log(`   📊 新增功能: post_url字段，双URL支持`);
      console.log(`   🔄 向后兼容: 保留原有url字段`);
      
      console.log(`\n🚀 v3.0版本亮点:`);
      console.log(`   1. ✅ 修复URL字段存储图片链接的问题`);
      console.log(`   2. ✅ 新增post_url字段存储标准帖子链接`);
      console.log(`   3. ✅ 修复深度测试脚本中的变量引用错误`);
      console.log(`   4. ✅ 更新所有采集脚本支持双URL字段`);
      console.log(`   5. ✅ 完善文档和发布说明`);
      
      return true;
    } else {
      console.log(`   ❌ 发现 ${this.errors.length} 个错误，需要修复后才能发布`);
      return false;
    }
  }

  run() {
    console.log('🔍 开始验证 Reddit AI Collect v3.0 版本状态...\n');

    this.verifyVersionInfo();
    this.verifyDatabaseSchema();
    this.verifyScriptUpdates();
    this.verifyBugFixes();
    this.verifyDocumentation();
    this.verifyUrlFieldHandling();
    this.verifyBackwardCompatibility();

    return this.generateReport();
  }
}

// 运行v3.0版本验证
const verifier = new V3PackageVerifier();
const success = verifier.run();

process.exit(success ? 0 : 1);
