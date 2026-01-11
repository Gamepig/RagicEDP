"""
AI Analyzer for 資料清洗系統 v2.

Uses AI models to analyze and suggest fixes for data violations.
"""

import os
from datetime import datetime, timezone
from typing import Any

from loguru import logger

from app.ai.openrouter_client import OpenRouterClient, get_openrouter_client
from app.ai.prompts import (
    SYSTEM_PROMPT_DATA_ANALYZER,
    SYSTEM_PROMPT_FK_RESOLVER,
    SYSTEM_PROMPT_FORMAT_FIXER,
    build_batch_analysis_prompt,
    build_fk_resolution_prompt,
    build_violation_analysis_prompt,
    parse_ai_response,
)
from app.cleaning.models import Violation, ViolationStatus


class AIAnalysisResult:
    """Result of AI analysis."""

    def __init__(
        self,
        violation_id: str,
        suggestion: str | None,
        confidence: float,
        reasoning: str | None = None,
        alternative: str | None = None,
        model_used: str | None = None,
    ):
        self.violation_id = violation_id
        self.suggestion = suggestion
        self.confidence = confidence
        self.reasoning = reasoning
        self.alternative = alternative
        self.model_used = model_used
        self.analyzed_at = datetime.now(timezone.utc)

    def should_auto_apply(self, threshold: float = 0.95) -> bool:
        """Check if suggestion should be auto-applied."""
        return self.confidence >= threshold and self.suggestion is not None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "violation_id": self.violation_id,
            "suggestion": self.suggestion,
            "confidence": self.confidence,
            "reasoning": self.reasoning,
            "alternative": self.alternative,
            "model_used": self.model_used,
            "analyzed_at": self.analyzed_at.isoformat(),
        }


class AIAnalyzer:
    """AI-powered violation analyzer."""

    def __init__(self, client: OpenRouterClient | None = None):
        """Initialize AI analyzer.

        Args:
            client: OpenRouter client. Defaults to shared client.
        """
        self.client = client or get_openrouter_client()

        # Thresholds from environment
        self.confidence_threshold = float(
            os.environ.get("AI_CONFIDENCE_THRESHOLD", "0.90")
        )
        self.auto_apply_threshold = float(
            os.environ.get("AI_AUTO_APPLY_THRESHOLD", "0.95")
        )

    def analyze_violation(
        self,
        violation: Violation,
        record_context: dict[str, Any] | None = None,
        similar_records: list[dict[str, Any]] | None = None,
    ) -> AIAnalysisResult:
        """Analyze a single violation and suggest fix.

        Args:
            violation: Violation to analyze
            record_context: Full record data for context
            similar_records: Similar records for reference

        Returns:
            AIAnalysisResult with suggestion
        """
        # Build prompt based on violation type
        violation_dict = {
            "table_code": violation.table_code,
            "field_name": violation.field_name,
            "before_value": violation.before_value,
            "rule_id": violation.rule_id,
            "severity": violation.severity.value,
        }

        # Select system prompt based on rule type
        system_prompt = self._select_system_prompt(violation.rule_id)

        # Build user prompt
        prompt = build_violation_analysis_prompt(
            violation_dict, record_context, similar_records
        )

        try:
            # Call AI
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ]

            response = self.client.chat(messages)

            # Parse response
            parsed = parse_ai_response(response.content)

            logger.debug(
                f"AI analysis for {violation.id}: "
                f"suggestion={parsed.get('suggestion')}, "
                f"confidence={parsed.get('confidence')}"
            )

            return AIAnalysisResult(
                violation_id=violation.id,
                suggestion=parsed.get("suggestion"),
                confidence=float(parsed.get("confidence", 0.0)),
                reasoning=parsed.get("reasoning"),
                alternative=parsed.get("alternative"),
                model_used=response.model,
            )

        except Exception as e:
            logger.error(f"AI analysis failed for {violation.id}: {e}")
            return AIAnalysisResult(
                violation_id=violation.id,
                suggestion=None,
                confidence=0.0,
                reasoning=f"Analysis failed: {e}",
            )

    def analyze_violations_batch(
        self,
        violations: list[Violation],
        table_context: dict[str, Any] | None = None,
    ) -> list[AIAnalysisResult]:
        """Analyze multiple violations in batch.

        Args:
            violations: List of violations to analyze
            table_context: Table statistics and schema info

        Returns:
            List of AIAnalysisResult
        """
        if not violations:
            return []

        # For small batches, analyze individually
        if len(violations) <= 3:
            return [self.analyze_violation(v) for v in violations]

        # Build batch prompt
        violations_dicts = [
            {
                "record_id": v.record_id,
                "field_name": v.field_name,
                "before_value": v.before_value,
                "rule_id": v.rule_id,
            }
            for v in violations
        ]

        prompt = build_batch_analysis_prompt(violations_dicts, table_context)

        try:
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT_DATA_ANALYZER},
                {"role": "user", "content": prompt},
            ]

            response = self.client.chat(messages, max_tokens=2048)
            parsed = parse_ai_response(response.content)

            # Handle array response
            results: list[AIAnalysisResult] = []

            if isinstance(parsed, list):
                # Map responses to violations
                response_map = {r.get("record_id"): r for r in parsed}

                for v in violations:
                    r = response_map.get(v.record_id, {})
                    results.append(
                        AIAnalysisResult(
                            violation_id=v.id,
                            suggestion=r.get("suggestion"),
                            confidence=float(r.get("confidence", 0.0)),
                            reasoning=r.get("reasoning"),
                            model_used=response.model,
                        )
                    )
            else:
                # Single response for all - analyze individually as fallback
                return [self.analyze_violation(v) for v in violations]

            return results

        except Exception as e:
            logger.error(f"Batch AI analysis failed: {e}")
            # Fallback to individual analysis
            return [self.analyze_violation(v) for v in violations]

    def analyze_fk_violation(
        self,
        violation: Violation,
        candidates: list[dict[str, Any]],
        reference_table_info: dict[str, Any],
    ) -> AIAnalysisResult:
        """Analyze foreign key violation with candidates.

        Args:
            violation: FK violation
            candidates: Potential matching records from reference table
            reference_table_info: Info about the reference table

        Returns:
            AIAnalysisResult with best match suggestion
        """
        violation_dict = {
            "field_name": violation.field_name,
            "before_value": violation.before_value,
        }

        prompt = build_fk_resolution_prompt(
            violation_dict, candidates, reference_table_info
        )

        try:
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT_FK_RESOLVER},
                {"role": "user", "content": prompt},
            ]

            response = self.client.chat(messages)
            parsed = parse_ai_response(response.content)

            return AIAnalysisResult(
                violation_id=violation.id,
                suggestion=parsed.get("suggestion"),
                confidence=float(parsed.get("confidence", 0.0)),
                reasoning=parsed.get("reasoning"),
                model_used=response.model,
            )

        except Exception as e:
            logger.error(f"FK analysis failed: {e}")
            return AIAnalysisResult(
                violation_id=violation.id,
                suggestion=None,
                confidence=0.0,
                reasoning=f"Analysis failed: {e}",
            )

    def apply_suggestions(
        self,
        violations: list[Violation],
        results: list[AIAnalysisResult],
    ) -> tuple[list[Violation], int]:
        """Apply AI suggestions to violations that meet threshold.

        Args:
            violations: Original violations
            results: AI analysis results

        Returns:
            Tuple of (updated violations, count of applied fixes)
        """
        # Create lookup by violation ID
        result_map = {r.violation_id: r for r in results}
        applied_count = 0

        for violation in violations:
            result = result_map.get(violation.id)
            if not result:
                continue

            # Store AI suggestion regardless of confidence
            violation.ai_suggestion = result.suggestion
            violation.ai_confidence = result.confidence

            # Auto-apply if confidence is high enough
            if result.should_auto_apply(self.auto_apply_threshold):
                violation.after_value = result.suggestion
                violation.status = ViolationStatus.AI_FIXED
                violation.fixed_at = datetime.now(timezone.utc)
                violation.fixed_by = f"ai:{result.model_used}"
                applied_count += 1

                logger.info(
                    f"AI auto-fixed {violation.field_name}: "
                    f"'{violation.before_value}' -> '{result.suggestion}' "
                    f"(confidence={result.confidence:.2f})"
                )

        return violations, applied_count

    def _select_system_prompt(self, rule_id: str) -> str:
        """Select appropriate system prompt based on rule type."""
        if rule_id.startswith("FK-"):
            return SYSTEM_PROMPT_FK_RESOLVER
        elif rule_id.startswith("FMT-"):
            return SYSTEM_PROMPT_FORMAT_FIXER
        else:
            return SYSTEM_PROMPT_DATA_ANALYZER


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_analyzer: AIAnalyzer | None = None


def get_analyzer() -> AIAnalyzer:
    """Get the default AI analyzer (singleton)."""
    global _default_analyzer
    if _default_analyzer is None:
        _default_analyzer = AIAnalyzer()
    return _default_analyzer


def analyze_violation(
    violation: Violation,
    record_context: dict[str, Any] | None = None,
) -> AIAnalysisResult:
    """Analyze a single violation using the default analyzer."""
    return get_analyzer().analyze_violation(violation, record_context)
