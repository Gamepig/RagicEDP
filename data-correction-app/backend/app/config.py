"""
Configuration for Data Correction API.
"""

import os
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # App settings
    app_name: str = "Data Correction API"
    debug: bool = Field(default=False)
    api_prefix: str = "/api/v1"

    # BigQuery settings
    gcp_project: str = Field(default="b25h01-ragic")
    bq_dataset: str = Field(default="erp_backup")
    bq_location: str = Field(default="asia-east1")

    # Google OAuth
    google_client_id: str = Field(default="")
    google_client_secret: str = Field(default="")
    oauth_redirect_uri: str = Field(default="http://localhost:8000/auth/callback")

    # Session
    secret_key: str = Field(default="change-me-in-production")
    session_max_age: int = Field(default=86400)  # 24 hours

    # CORS
    allowed_origins: str = Field(default="http://localhost:5173")

    # AI settings
    openrouter_api_key: str = Field(default="")
    ai_auto_apply_threshold: float = Field(default=0.95)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
