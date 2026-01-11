"""
Correction routes for manual data fixes.
"""

from fastapi import APIRouter, HTTPException, status

from app.auth.google_oauth import CurrentUser
from app.schemas.correction import (
    BulkCorrectionCreate,
    CorrectionCreate,
    CorrectionResponse,
)
from app.services.correction_service import CorrectionService

router = APIRouter(prefix="/corrections", tags=["corrections"])


def get_correction_service() -> CorrectionService:
    """Get correction service instance."""
    return CorrectionService()


@router.post("/", response_model=CorrectionResponse)
async def create_correction(
    user: CurrentUser,
    correction: CorrectionCreate,
):
    """Create a manual correction for a violation.

    Args:
        correction: Correction details

    Returns:
        Created correction with metadata
    """
    service = get_correction_service()

    try:
        result = await service.apply_correction(
            violation_id=correction.violation_id,
            new_value=correction.new_value,
            corrected_by=user.email,
            status=correction.status,
            comment=correction.comment,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except LookupError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/bulk", response_model=list[CorrectionResponse])
async def create_bulk_corrections(
    user: CurrentUser,
    bulk: BulkCorrectionCreate,
):
    """Create multiple corrections at once.

    Args:
        bulk: List of corrections

    Returns:
        List of created corrections
    """
    service = get_correction_service()

    results = []
    for correction in bulk.corrections:
        try:
            result = await service.apply_correction(
                violation_id=correction.violation_id,
                new_value=correction.new_value,
                corrected_by=user.email,
                status=correction.status,
                comment=correction.comment,
            )
            results.append(result)
        except (ValueError, LookupError) as e:
            # Log error but continue with other corrections
            pass

    return results
