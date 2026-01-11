"""
Authentication routes.
"""

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

from app.auth.google_oauth import (
    CurrentUser,
    google_oauth_callback,
    google_oauth_login,
)
from app.schemas.user import UserInfo

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.get("/login")
async def login(request: Request):
    """Redirect to Google OAuth login."""
    return await google_oauth_login(request)


@router.get("/callback")
async def callback(request: Request):
    """Handle OAuth callback and create session."""
    user = await google_oauth_callback(request)
    # Redirect to frontend after successful login
    return RedirectResponse(url="/", status_code=302)


@router.get("/me", response_model=UserInfo)
async def get_me(user: CurrentUser):
    """Get current user info."""
    return user


@router.post("/logout")
async def logout(request: Request):
    """Clear session and logout."""
    request.session.clear()
    return {"message": "Logged out"}
