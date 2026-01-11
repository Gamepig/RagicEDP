"""
Prompt Templates for AI-powered data cleaning.

Contains structured prompts for analyzing and fixing data issues.
"""

from typing import Any


# =============================================================================
# System Prompts
# =============================================================================

SYSTEM_PROMPT_DATA_ANALYZER = """你是一位專業的資料品質分析師，專精於 ERP 系統資料清洗。

你的任務是分析資料問題並提供修正建議。請遵循以下原則：

1. **準確性優先**：只在有高度信心時才建議修正
2. **上下文理解**：考慮欄位之間的關聯性
3. **業務邏輯**：理解零售/電商業務場景
4. **格式一致性**：確保修正後符合標準格式

回覆時請使用 JSON 格式，包含：
- suggestion: 建議的修正值
- confidence: 信心度 (0.0-1.0)
- reasoning: 簡短的修正理由
- alternative: 可選的替代建議（若有）"""

SYSTEM_PROMPT_FK_RESOLVER = """你是一位 ERP 資料關聯分析專家。

你的任務是根據部分資訊推斷正確的外鍵關聯。請分析以下情境：
- 客戶可能使用不同名稱下單
- 品牌代碼可能有錯字或別稱
- 地址可能格式不一致

提供修正建議時，請確保：
1. 考慮可能的相似名稱匹配
2. 分析歷史交易模式
3. 評估地理位置合理性

回覆格式為 JSON，包含 suggestion、confidence、reasoning。"""

SYSTEM_PROMPT_FORMAT_FIXER = """你是一位資料格式標準化專家。

專注於以下格式問題的修正：
- 電話號碼：台灣格式（09xxxxxxxx 或 0x-xxxxxxxx）
- 電子郵件：標準 email 格式
- 日期：ISO 8601 格式 (YYYY-MM-DD)
- 地址：縣市區路段格式
- 金額：數字格式，無千分位

請直接提供標準化後的值，並說明轉換邏輯。

回覆格式為 JSON：
{
  "suggestion": "標準化後的值",
  "confidence": 0.95,
  "reasoning": "轉換說明"
}"""


# =============================================================================
# Prompt Templates
# =============================================================================

def build_violation_analysis_prompt(
    violation: dict[str, Any],
    record_context: dict[str, Any] | None = None,
    similar_records: list[dict[str, Any]] | None = None,
) -> str:
    """Build prompt for analyzing a data violation.

    Args:
        violation: Violation details
        record_context: Full record data
        similar_records: Similar records for reference

    Returns:
        Formatted prompt string
    """
    prompt = f"""請分析以下資料問題並提供修正建議：

## 問題詳情
- **表格**: {violation.get('table_code', 'N/A')}
- **欄位**: {violation.get('field_name', 'N/A')}
- **目前值**: {violation.get('before_value', 'N/A')}
- **規則ID**: {violation.get('rule_id', 'N/A')}
- **嚴重程度**: {violation.get('severity', 'medium')}
"""

    if record_context:
        prompt += f"""
## 記錄上下文
```json
{_format_context(record_context)}
```
"""

    if similar_records:
        prompt += f"""
## 相似記錄參考
以下是資料庫中類似的記錄：
```json
{_format_similar_records(similar_records)}
```
"""

    prompt += """
## 請提供
1. 建議的修正值
2. 信心度 (0.0-1.0)
3. 修正理由

請以 JSON 格式回覆。"""

    return prompt


def build_batch_analysis_prompt(
    violations: list[dict[str, Any]],
    table_context: dict[str, Any] | None = None,
) -> str:
    """Build prompt for batch violation analysis.

    Args:
        violations: List of violations to analyze
        table_context: Table schema and statistics

    Returns:
        Formatted prompt string
    """
    prompt = """請分析以下批量資料問題：

## 問題列表
"""

    for i, v in enumerate(violations[:10], 1):  # Limit to 10
        prompt += f"""
### 問題 {i}
- 欄位: {v.get('field_name', 'N/A')}
- 目前值: {v.get('before_value', 'N/A')}
- 記錄ID: {v.get('record_id', 'N/A')}
"""

    if table_context:
        prompt += f"""
## 表格統計
- 總記錄數: {table_context.get('total_records', 'N/A')}
- 問題記錄數: {table_context.get('violation_count', 'N/A')}
"""

    prompt += """
## 請提供
對每個問題提供修正建議，格式為 JSON 陣列：
```json
[
  {"record_id": "...", "suggestion": "...", "confidence": 0.0, "reasoning": "..."}
]
```"""

    return prompt


def build_fk_resolution_prompt(
    violation: dict[str, Any],
    candidates: list[dict[str, Any]],
    reference_table_info: dict[str, Any],
) -> str:
    """Build prompt for foreign key resolution.

    Args:
        violation: FK violation details
        candidates: Potential matching records
        reference_table_info: Reference table info

    Returns:
        Formatted prompt string
    """
    prompt = f"""請幫助解決以下外鍵關聯問題：

## 問題
- **欄位**: {violation.get('field_name', 'N/A')}
- **目前值**: {violation.get('before_value', 'N/A')}
- **參照表**: {reference_table_info.get('table_name', 'N/A')}

## 可能的匹配候選
"""

    for i, candidate in enumerate(candidates[:5], 1):
        prompt += f"""
### 候選 {i}
- ID: {candidate.get('id', 'N/A')}
- 名稱: {candidate.get('name', 'N/A')}
- 其他資訊: {candidate.get('extra', 'N/A')}
"""

    prompt += """
## 請分析
1. 最可能的正確關聯
2. 匹配的理由
3. 信心度

以 JSON 格式回覆。"""

    return prompt


def build_address_standardization_prompt(
    address: str,
    postal_codes: list[dict[str, Any]] | None = None,
) -> str:
    """Build prompt for address standardization.

    Args:
        address: Raw address string
        postal_codes: Optional list of known postal codes

    Returns:
        Formatted prompt string
    """
    prompt = f"""請將以下地址標準化為台灣郵政地址格式：

## 原始地址
{address}

## 標準格式
郵遞區號 縣市 區 路/街/大道 段 巷 弄 號 樓

## 請提供
1. 標準化後的完整地址
2. 解析出的各部分（郵遞區號、縣市、區等）
3. 信心度

以 JSON 格式回覆：
```json
{{
  "standardized_address": "...",
  "components": {{
    "postal_code": "...",
    "city": "...",
    "district": "...",
    "road": "...",
    "number": "..."
  }},
  "confidence": 0.0,
  "reasoning": "..."
}}
```"""

    return prompt


# =============================================================================
# Helper Functions
# =============================================================================

def _format_context(context: dict[str, Any], max_fields: int = 15) -> str:
    """Format context dict, limiting to max fields."""
    if len(context) <= max_fields:
        return str(context)

    # Select important fields
    important_keys = [
        "ragic_id", "客戶編號", "訂單編號", "品牌", "通路",
        "訂單日期", "訂單金額", "聯絡電話", "Email", "地址"
    ]

    filtered = {k: v for k, v in context.items() if k in important_keys}

    # Add remaining fields up to max
    remaining = max_fields - len(filtered)
    for k, v in context.items():
        if k not in filtered and remaining > 0:
            filtered[k] = v
            remaining -= 1

    return str(filtered)


def _format_similar_records(records: list[dict[str, Any]], max_records: int = 3) -> str:
    """Format similar records for prompt."""
    formatted = []
    for record in records[:max_records]:
        formatted.append(_format_context(record, max_fields=8))
    return "\n".join(formatted)


# =============================================================================
# Response Parsing
# =============================================================================

def parse_ai_response(response: str) -> dict[str, Any]:
    """Parse AI response to extract suggestion.

    Args:
        response: Raw AI response string

    Returns:
        Dict with suggestion, confidence, reasoning
    """
    import json
    import re

    # Try to extract JSON from response
    json_match = re.search(r'\{[\s\S]*\}', response)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # Try to extract from markdown code block
    code_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
    if code_match:
        try:
            return json.loads(code_match.group(1))
        except json.JSONDecodeError:
            pass

    # Fallback: return raw response
    return {
        "suggestion": None,
        "confidence": 0.0,
        "reasoning": response,
        "parse_error": True,
    }
