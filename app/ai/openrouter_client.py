"""
OpenRouter API Client for 資料清洗系統 v2.

Provides access to AI models (Claude, Gemini) via OpenRouter API.
"""

import os
from typing import Any

import httpx
from loguru import logger
from pydantic import BaseModel, Field


class OpenRouterConfig(BaseModel):
    """Configuration for OpenRouter API."""

    api_key: str = Field(default="")
    base_url: str = Field(default="https://openrouter.ai/api/v1")
    model: str = Field(default="anthropic/claude-3.5-sonnet")
    fallback_model: str = Field(default="google/gemini-pro")
    timeout: int = Field(default=30)
    max_retries: int = Field(default=3)

    @classmethod
    def from_env(cls) -> "OpenRouterConfig":
        """Load configuration from environment variables."""
        return cls(
            api_key=os.environ.get("OPENROUTER_API_KEY", ""),
            base_url=os.environ.get(
                "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
            ),
            model=os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet"),
            fallback_model=os.environ.get(
                "OPENROUTER_FALLBACK_MODEL", "google/gemini-pro"
            ),
            timeout=int(os.environ.get("OPENROUTER_TIMEOUT", "30")),
            max_retries=int(os.environ.get("OPENROUTER_MAX_RETRIES", "3")),
        )


class AIResponse(BaseModel):
    """Response from AI model."""

    content: str
    model: str
    usage: dict[str, int] = Field(default_factory=dict)
    raw_response: dict[str, Any] | None = None


class OpenRouterClient:
    """Client for OpenRouter API."""

    def __init__(self, config: OpenRouterConfig | None = None):
        """Initialize OpenRouter client.

        Args:
            config: Configuration. Defaults to loading from env.
        """
        self.config = config or OpenRouterConfig.from_env()

        if not self.config.api_key:
            logger.warning("OpenRouter API key not configured")

        self._client = httpx.Client(
            base_url=self.config.base_url,
            timeout=self.config.timeout,
            headers={
                "Authorization": f"Bearer {self.config.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://ragic-edp.example.com",
                "X-Title": "RagicEDP Data Cleaning",
            },
        )

    def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.1,
        max_tokens: int = 1024,
    ) -> AIResponse:
        """Send chat completion request.

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model to use. Defaults to config.model
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate

        Returns:
            AIResponse with content and metadata

        Raises:
            OpenRouterError: If API call fails after retries
        """
        model = model or self.config.model

        for attempt in range(self.config.max_retries):
            try:
                response = self._make_request(
                    messages=messages,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return response

            except httpx.HTTPStatusError as e:
                logger.warning(
                    f"OpenRouter request failed (attempt {attempt + 1}): {e}"
                )

                # Try fallback model on last attempt
                if attempt == self.config.max_retries - 1:
                    if model != self.config.fallback_model:
                        logger.info(f"Trying fallback model: {self.config.fallback_model}")
                        return self._make_request(
                            messages=messages,
                            model=self.config.fallback_model,
                            temperature=temperature,
                            max_tokens=max_tokens,
                        )
                    raise OpenRouterError(f"API call failed: {e}") from e

            except httpx.TimeoutException as e:
                logger.warning(f"OpenRouter timeout (attempt {attempt + 1})")
                if attempt == self.config.max_retries - 1:
                    raise OpenRouterError(f"Request timed out: {e}") from e

        raise OpenRouterError("Max retries exceeded")

    def _make_request(
        self,
        messages: list[dict[str, str]],
        model: str,
        temperature: float,
        max_tokens: int,
    ) -> AIResponse:
        """Make a single API request."""
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        response = self._client.post("/chat/completions", json=payload)
        response.raise_for_status()

        data = response.json()

        # Extract content from response
        content = ""
        if data.get("choices"):
            content = data["choices"][0].get("message", {}).get("content", "")

        usage = data.get("usage", {})

        return AIResponse(
            content=content,
            model=data.get("model", model),
            usage={
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            },
            raw_response=data,
        )

    def simple_query(
        self,
        prompt: str,
        system_prompt: str | None = None,
    ) -> str:
        """Simple query with optional system prompt.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt

        Returns:
            Response content string
        """
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        response = self.chat(messages)
        return response.content

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self) -> "OpenRouterClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


class OpenRouterError(Exception):
    """Error from OpenRouter API."""

    pass


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_client: OpenRouterClient | None = None


def get_openrouter_client() -> OpenRouterClient:
    """Get the default OpenRouter client (singleton)."""
    global _default_client
    if _default_client is None:
        _default_client = OpenRouterClient()
    return _default_client


def simple_query(prompt: str, system_prompt: str | None = None) -> str:
    """Run a simple query using the default client."""
    return get_openrouter_client().simple_query(prompt, system_prompt)
