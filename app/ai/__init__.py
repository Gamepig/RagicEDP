"""
AI Module for 資料清洗系統 v2.

Provides AI-powered analysis and suggestions for data cleaning.
"""

from app.ai.analyzer import (
    AIAnalysisResult,
    AIAnalyzer,
    analyze_violation,
    get_analyzer,
)
from app.ai.openrouter_client import (
    AIResponse,
    OpenRouterClient,
    OpenRouterConfig,
    OpenRouterError,
    get_openrouter_client,
    simple_query,
)
from app.ai.prompts import (
    SYSTEM_PROMPT_DATA_ANALYZER,
    SYSTEM_PROMPT_FK_RESOLVER,
    SYSTEM_PROMPT_FORMAT_FIXER,
    build_batch_analysis_prompt,
    build_fk_resolution_prompt,
    build_violation_analysis_prompt,
    parse_ai_response,
)

__all__ = [
    # Analyzer
    "AIAnalyzer",
    "AIAnalysisResult",
    "get_analyzer",
    "analyze_violation",
    # OpenRouter Client
    "OpenRouterClient",
    "OpenRouterConfig",
    "OpenRouterError",
    "AIResponse",
    "get_openrouter_client",
    "simple_query",
    # Prompts
    "SYSTEM_PROMPT_DATA_ANALYZER",
    "SYSTEM_PROMPT_FK_RESOLVER",
    "SYSTEM_PROMPT_FORMAT_FIXER",
    "build_violation_analysis_prompt",
    "build_batch_analysis_prompt",
    "build_fk_resolution_prompt",
    "parse_ai_response",
]
