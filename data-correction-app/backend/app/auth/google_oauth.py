"""
Google OAuth authentication for Data Correction API.

Implements Google OAuth 2.0 flow for user authentication.
"""

import secrets
from typing import Annotated

from authlib.integrations.starlette_client import OAuth
from fastapi import Depends, HTTPException, Request, status
from starlette.config import Config

from app.config import Settings, get_settings
from app.schemas.user import UserInfo


# OAuth client setup
oauth = OAuth()


def setup_oauth(settings: Settings) -> None:
    """Configure OAuth with Google credentials."""
    if settings.google_client_id and settings.google_client_secret:
        oauth.register(
            name="google",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )


async def google_oauth_login(request: Request) -> dict:
    """Initiate Google OAuth login flow.

    Returns:
        Redirect URL to Google's OAuth consent page
    """
    settings = get_settings()

    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth not configured",
        )

    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    request.session["oauth_state"] = state

    google = oauth.create_client("google")
    redirect_uri = settings.oauth_redirect_uri

    return await google.authorize_redirect(request, redirect_uri, state=state)


async def google_oauth_callback(request: Request) -> UserInfo:
    """Handle Google OAuth callback.

    Args:
        request: FastAPI request with OAuth callback params

    Returns:
        User information from Google

    Raises:
        HTTPException: If OAuth fails or state mismatch
    """
    # Verify state for CSRF protection
    state = request.query_params.get("state")
    stored_state = request.session.get("oauth_state")

    if not state or state != stored_state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state",
        )

    # Exchange code for token
    google = oauth.create_client("google")
    token = await google.authorize_access_token(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to get access token",
        )

    # Get user info
    user_info = token.get("userinfo")
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to get user info",
        )

    # Store user in session
    user = UserInfo(
        email=user_info["email"],
        name=user_info.get("name", user_info["email"]),
        picture=user_info.get("picture"),
    )

    request.session["user"] = user.model_dump()

    return user


async def get_current_user(request: Request) -> UserInfo:
    """Get the current authenticated user from session.

    Args:
        request: FastAPI request

    Returns:
        Current user info

    Raises:
        HTTPException: If not authenticated
    """
    user_data = request.session.get("user")

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UserInfo(**user_data)


# Dependency for protected routes
CurrentUser = Annotated[UserInfo, Depends(get_current_user)]
