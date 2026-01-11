"""
AI suggestion routes.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.auth.google_oauth import CurrentUser
from app.schemas.correction import AISuggestionApply, CorrectionResponse
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["ai"])


def get_ai_service() -> AIService:
    """Get AI service instance."""
    return AIService()


class SuggestionRequest(BaseModel):
    """Request for AI suggestion."""

    violation_id: str


class SuggestionResponse(BaseModel):
    """AI suggestion response."""

    violation_id: str
    suggestion: str | None
    confidence: float
    reasoning: str | None


@router.post("/suggest", response_model=SuggestionResponse)
async def get_ai_suggestion(
    user: CurrentUser,
    request: SuggestionRequest,
):
    """Get AI suggestion for a violation.

    Args:
        request: Violation to analyze

    Returns:
        AI suggestion with confidence score
    """
    service = get_ai_service()

    try:
        result = await service.get_suggestion(request.violation_id)
        return result
    except LookupError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/apply", response_model=CorrectionResponse)
async def apply_ai_suggestion(
    user: CurrentUser,
    apply_request: AISuggestionApply,
):
    """Apply or reject AI suggestion.

    Args:
        apply_request: Apply request with approval decision

    Returns:
        Correction result if applied
    """
    service = get_ai_service()

    try:
        if apply_request.apply:
            result = await service.apply_suggestion(
                violation_id=apply_request.violation_id,
                applied_by=user.email,
                comment=apply_request.comment,
            )
            return result
        else:
            await service.reject_suggestion(
                violation_id=apply_request.violation_id,
                rejected_by=user.email,
                comment=apply_request.comment,
            )
            raise HTTPException(
                status_code=status.HTTP_200_OK,
                detail="Suggestion rejected",
            )
    except LookupError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
