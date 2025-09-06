#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
内容处理和关键词提取模块
负责AI相关内容识别、关键词提取、技术分类等
"""

import re
import json
import logging
from typing import List, Dict, Tuple, Optional
from textblob import TextBlob
import nltk
from daily_collection_config import AI_KEYWORDS

# 简化版TF-IDF实现，替代scikit-learn
from collections import Counter
import math

# 下载必要的NLTK数据
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

class ContentProcessor:
    """内容处理器 - 负责AI内容分析和关键词提取"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.stop_words = set(stopwords.words('english'))
        
        # 合并所有AI关键词
        self.ai_keywords_flat = []
        for category, keywords in AI_KEYWORDS.items():
            self.ai_keywords_flat.extend(keywords)
        
        # 编译正则表达式模式
        self._compile_patterns()
        
        # 初始化简化版TF-IDF处理器
        self.max_features = 1000
        self.min_df = 1
    
    def _compile_patterns(self):
        """编译常用的正则表达式模式"""
        self.patterns = {
            # 模型名称模式
            "models": re.compile(r'\b(GPT-?\d+|Claude-?\d+|LLaMA-?\d+|Mistral-?\d+|BERT|T5|PaLM|Gemini|Llama|ChatGPT)\b', re.IGNORECASE),
            
            # 性能指标模式
            "metrics": re.compile(r'\b(\d+\.?\d*)\s*(BLEU|ROUGE|accuracy|F1|perplexity|MMLU|HumanEval)\b', re.IGNORECASE),
            
            # 参数规模模式
            "parameters": re.compile(r'\b(\d+\.?\d*)\s*([BMK]|billion|million|thousand)?\s*(parameters?|params?)\b', re.IGNORECASE),
            
            # 数据规模模式
            "dataset_size": re.compile(r'\b(\d+\.?\d*)\s*([BMK]|billion|million|thousand)?\s*(tokens?|examples?|samples?)\b', re.IGNORECASE),
            
            # 技术框架模式
            "frameworks": re.compile(r'\b(PyTorch|TensorFlow|JAX|Hugging\s*Face|transformers|scikit-learn|Keras|FastAI)\b', re.IGNORECASE),
            
            # GitHub链接模式
            "github_links": re.compile(r'https?://github\.com/[\w\-\.]+/[\w\-\.]+', re.IGNORECASE),
            
            # arXiv论文模式
            "arxiv_papers": re.compile(r'(?:arxiv:|arXiv:)\s*(\d{4}\.\d{4,5})', re.IGNORECASE),
            
            # 公司/机构模式
            "organizations": re.compile(r'\b(OpenAI|Anthropic|Google|Microsoft|Meta|DeepMind|NVIDIA|Stability\s*AI)\b', re.IGNORECASE)
        }
    
    def is_ai_related(self, title: str, content: str = "") -> Tuple[bool, str, List[str]]:
        """
        检查内容是否与AI相关
        返回: (是否相关, 主要分类, 匹配的关键词列表)
        """
        text = (title + " " + content).lower()
        matched_keywords = []
        primary_category = None
        
        # 检查各个分类的关键词
        for category, keywords in AI_KEYWORDS.items():
            category_matches = []
            for keyword in keywords:
                if keyword.lower() in text:
                    category_matches.append(keyword)
                    matched_keywords.append(keyword)
            
            # 如果这个分类有匹配且还没有主分类，设为主分类
            if category_matches and not primary_category:
                primary_category = category
        
        is_related = len(matched_keywords) > 0
        
        # 如果没有关键词匹配，检查是否有AI相关的技术术语
        if not is_related:
            ai_terms = [
                "artificial intelligence", "machine learning", "deep learning",
                "neural network", "algorithm", "model training", "inference",
                "automation", "prediction", "classification", "regression"
            ]
            for term in ai_terms:
                if term in text:
                    is_related = True
                    primary_category = "通用AI"
                    matched_keywords.append(term)
                    break
        
        return is_related, primary_category or "未分类", matched_keywords
    
    def extract_keywords_tfidf(self, text: str, max_keywords: int = 10) -> List[Dict]:
        """使用简化版频次分析提取关键词"""
        try:
            # 预处理文本
            clean_text = self._clean_text(text)
            
            if len(clean_text.split()) < 3:  # 文本太短
                return []
            
            # 分词并过滤停用词
            words = [word.lower() for word in clean_text.split() 
                    if len(word) > 3 and word.lower() not in self.stop_words]
            
            # 计算词频
            word_freq = Counter(words)
            
            # 生成关键词列表
            keywords = []
            for word, freq in word_freq.most_common(max_keywords):
                if freq >= 2:  # 至少出现2次
                    keywords.append({
                        "keyword": word,
                        "confidence_score": min(1.0, freq / 10.0),  # 简化评分
                        "extraction_method": "frequency",
                        "keyword_type": "general"
                    })
            
            return keywords
            
        except Exception as e:
            self.logger.error(f"关键词提取失败: {e}")
            return []
    
    def extract_technical_terms(self, text: str) -> List[Dict]:
        """提取技术术语"""
        technical_terms = []
        
        for pattern_name, pattern in self.patterns.items():
            matches = pattern.findall(text)
            for match in matches:
                if isinstance(match, tuple):
                    term = " ".join(str(m) for m in match if m)
                else:
                    term = str(match)
                
                technical_terms.append({
                    "keyword": term,
                    "category": pattern_name,
                    "confidence_score": 0.9,
                    "extraction_method": "regex",
                    "keyword_type": "technical"
                })
        
        return technical_terms
    
    def extract_ai_keywords(self, text: str) -> List[Dict]:
        """提取AI相关关键词"""
        text_lower = text.lower()
        ai_keywords = []
        
        for category, keywords in AI_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in text_lower:
                    # 计算词频
                    frequency = text_lower.count(keyword.lower())
                    
                    # 判断位置
                    position = "content"
                    if keyword.lower() in text[:100].lower():  # 前100个字符
                        position = "title"
                    elif keyword.lower() in text[:100].lower() and keyword.lower() in text[100:].lower():
                        position = "both"
                    
                    ai_keywords.append({
                        "keyword": keyword,
                        "category": category,
                        "confidence_score": min(0.9, 0.5 + frequency * 0.1),
                        "extraction_method": "dictionary",
                        "keyword_type": "ai_concept",
                        "frequency": frequency,
                        "position": position
                    })
        
        return ai_keywords
    
    def _clean_text(self, text: str) -> str:
        """清理文本"""
        if not text:
            return ""
        
        # 移除URL
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        
        # 移除特殊字符，保留字母数字和空格
        text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
        
        # 移除多余空格
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def extract_all_keywords(self, title: str, content: str) -> List[Dict]:
        """提取所有类型的关键词"""
        full_text = title + " " + content
        
        all_keywords = []
        
        # 1. 提取AI关键词
        ai_keywords = self.extract_ai_keywords(full_text)
        all_keywords.extend(ai_keywords)
        
        # 2. 提取技术术语
        technical_terms = self.extract_technical_terms(full_text)
        all_keywords.extend(technical_terms)
        
        # 3. 提取TF-IDF关键词
        tfidf_keywords = self.extract_keywords_tfidf(full_text)
        all_keywords.extend(tfidf_keywords)
        
        # 去重和排序
        unique_keywords = self._deduplicate_keywords(all_keywords)
        
        return unique_keywords
    
    def _deduplicate_keywords(self, keywords: List[Dict]) -> List[Dict]:
        """去重关键词"""
        seen_keywords = {}
        
        for keyword_data in keywords:
            keyword = keyword_data["keyword"].lower()
            
            if keyword in seen_keywords:
                # 保留置信度更高的
                if keyword_data["confidence_score"] > seen_keywords[keyword]["confidence_score"]:
                    seen_keywords[keyword] = keyword_data
            else:
                seen_keywords[keyword] = keyword_data
        
        # 按置信度排序
        result = list(seen_keywords.values())
        result.sort(key=lambda x: x["confidence_score"], reverse=True)
        
        return result
    
    def classify_content(self, title: str, content: str) -> Dict:
        """对内容进行分类"""
        full_text = (title + " " + content).lower()
        
        # 内容类型分类
        content_types = {
            "研究论文": ["paper", "arxiv", "research", "study", "analysis", "survey", "review"],
            "工具资源": ["tool", "library", "framework", "api", "model", "github", "code", "implementation"],
            "应用案例": ["use case", "application", "demo", "project", "example", "tutorial"],
            "行业动态": ["news", "announcement", "release", "update", "company", "industry"]
        }
        
        # AI技术分类
        ai_categories = {
            "LLM": ["llm", "large language model", "gpt", "bert", "transformer", "language model"],
            "计算机视觉": ["computer vision", "cv", "image", "visual", "object detection", "segmentation"],
            "自然语言处理": ["nlp", "natural language", "text", "sentiment", "translation"],
            "机器学习": ["machine learning", "ml", "supervised", "unsupervised", "classification"],
            "深度学习": ["deep learning", "neural network", "cnn", "rnn", "lstm"],
            "强化学习": ["reinforcement learning", "rl", "policy", "reward", "agent"],
            "生成式AI": ["generative", "generation", "diffusion", "gan", "stable diffusion"],
            "AGI": ["agi", "artificial general intelligence", "reasoning", "consciousness"]
        }
        
        # 分类评分
        content_scores = {}
        ai_scores = {}
        
        for category, keywords in content_types.items():
            score = sum(1 for keyword in keywords if keyword in full_text)
            if score > 0:
                content_scores[category] = score
        
        for category, keywords in ai_categories.items():
            score = sum(1 for keyword in keywords if keyword in full_text)
            if score > 0:
                ai_scores[category] = score
        
        # 确定主要分类
        primary_content_type = max(content_scores.items(), key=lambda x: x[1])[0] if content_scores else "其他"
        primary_ai_category = max(ai_scores.items(), key=lambda x: x[1])[0] if ai_scores else "通用AI"
        
        # 计算置信度
        content_confidence = min(1.0, max(content_scores.values()) / 3) if content_scores else 0.5
        ai_confidence = min(1.0, max(ai_scores.values()) / 2) if ai_scores else 0.5
        
        return {
            "primary_category": primary_ai_category,
            "secondary_categories": list(ai_scores.keys()),
            "content_type": primary_content_type,
            "confidence_score": (content_confidence + ai_confidence) / 2,
            "classification_model": "rule_based",
            "tech_stack": self._extract_tech_stack(full_text),
            "application_domain": self._determine_application_domain(full_text),
            "complexity_level": self._assess_complexity(full_text)
        }
    
    def _extract_tech_stack(self, text: str) -> Dict:
        """提取技术栈信息"""
        tech_stack = {
            "frameworks": [],
            "languages": [],
            "platforms": [],
            "tools": []
        }
        
        # 框架检测
        frameworks = ["pytorch", "tensorflow", "jax", "keras", "scikit-learn", "hugging face"]
        for framework in frameworks:
            if framework in text:
                tech_stack["frameworks"].append(framework)
        
        # 编程语言检测
        languages = ["python", "javascript", "r", "julia", "c++", "java"]
        for lang in languages:
            if lang in text:
                tech_stack["languages"].append(lang)
        
        # 平台检测
        platforms = ["aws", "azure", "gcp", "google cloud", "nvidia", "cuda"]
        for platform in platforms:
            if platform in text:
                tech_stack["platforms"].append(platform)
        
        return tech_stack
    
    def _determine_application_domain(self, text: str) -> str:
        """确定应用领域"""
        domains = {
            "医疗健康": ["medical", "healthcare", "diagnosis", "drug", "patient"],
            "自动驾驶": ["autonomous", "driving", "vehicle", "car", "transportation"],
            "金融科技": ["finance", "fintech", "trading", "banking", "risk"],
            "教育": ["education", "learning", "student", "teaching", "course"],
            "娱乐": ["gaming", "entertainment", "music", "art", "creative"],
            "企业应用": ["business", "enterprise", "productivity", "workflow"],
            "科研": ["research", "academic", "scientific", "experiment"]
        }
        
        for domain, keywords in domains.items():
            if any(keyword in text for keyword in keywords):
                return domain
        
        return "通用应用"
    
    def _assess_complexity(self, text: str) -> str:
        """评估技术复杂度"""
        complexity_indicators = {
            "high": ["sota", "state-of-the-art", "novel", "breakthrough", "advanced", "complex"],
            "medium": ["improved", "enhanced", "optimized", "efficient", "practical"],
            "low": ["simple", "basic", "easy", "tutorial", "beginner", "introduction"]
        }
        
        for level, indicators in complexity_indicators.items():
            if any(indicator in text for indicator in indicators):
                return level
        
        return "medium"
    
    def calculate_quality_score(self, post_data: Dict) -> float:
        """计算内容质量评分"""
        score = 0.0
        
        # 基础指标 (40分)
        score += min(20, post_data.get("score", 0) / 10)  # Reddit评分
        score += min(10, post_data.get("num_comments", 0) / 5)  # 评论数
        score += post_data.get("upvote_ratio", 0.5) * 10  # 点赞比例
        
        # 内容质量 (30分)
        title_length = len(post_data.get("title", ""))
        content_length = len(post_data.get("selftext", ""))
        
        score += min(10, title_length / 10)  # 标题长度
        score += min(15, content_length / 100)  # 内容长度
        score += 5 if post_data.get("url") else 0  # 是否有外部链接
        
        # AI相关性 (20分)
        title = post_data.get("title", "")
        content = post_data.get("selftext", "")
        is_ai, category, keywords = self.is_ai_related(title, content)
        
        if is_ai:
            score += 15 + min(5, len(keywords))  # AI相关性基础分 + 关键词数量
        
        # 时效性 (10分)
        import time
        post_age_hours = (time.time() - post_data.get("created_utc", 0)) / 3600
        if post_age_hours < 24:
            score += 10
        elif post_age_hours < 72:
            score += 5
        
        return min(100.0, score)

if __name__ == "__main__":
    # 测试内容处理器
    processor = ContentProcessor()
    
    # 测试文本
    test_title = "New GPT-4 model achieves 95% accuracy on MMLU benchmark"
    test_content = "Researchers at OpenAI have developed an improved version of GPT-4 that shows significant improvements in reasoning tasks. The model was trained using PyTorch and achieves state-of-the-art performance on multiple benchmarks including MMLU, HumanEval, and MATH. The 175B parameter model demonstrates emergent abilities in few-shot learning scenarios."
    
    print("=== AI相关性检测 ===")
    is_ai, category, keywords = processor.is_ai_related(test_title, test_content)
    print(f"是否AI相关: {is_ai}")
    print(f"主要分类: {category}")
    print(f"匹配关键词: {keywords[:5]}")  # 显示前5个
    
    print("\n=== 关键词提取 ===")
    all_keywords = processor.extract_all_keywords(test_title, test_content)
    for kw in all_keywords[:10]:  # 显示前10个
        print(f"  {kw['keyword']} ({kw['extraction_method']}) - {kw['confidence_score']:.2f}")
    
    print("\n=== 内容分类 ===")
    classification = processor.classify_content(test_title, test_content)
    print(f"主分类: {classification['primary_category']}")
    print(f"内容类型: {classification['content_type']}")
    print(f"置信度: {classification['confidence_score']:.2f}")
    
    print("\n=== 质量评分 ===")
    test_post = {
        "title": test_title,
        "selftext": test_content,
        "score": 150,
        "num_comments": 25,
        "upvote_ratio": 0.92,
        "url": "https://arxiv.org/abs/2023.12345",
        "created_utc": time.time() - 3600  # 1小时前
    }
    quality_score = processor.calculate_quality_score(test_post)
    print(f"质量评分: {quality_score:.1f}/100")
