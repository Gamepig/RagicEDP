"""
User schemas.
"""

from pydantic import BaseModel, EmailStr


class UserInfo(BaseModel):
    """User information from Google OAuth."""

    email: EmailStr
    name: str
    picture: str | None = None
