"""
OpenRouter API Client for 資料清洗系統 v2.

Provides access to AI models via OpenRouter API with automatic model switching.
"""

import os
import time
from dataclasses import dataclass
from typing import Any

import httpx
from loguru import logger
from pydantic import BaseModel, Field


# =============================================================================
# Free Models Pool (僅使用免費模型)
# =============================================================================

# Available free models on OpenRouter (ordered by priority)
FREE_MODELS = [
    "meta-llama/llama-3.3-70b-instruct:free",  # Primary - best quality
    "meta-llama/llama-3.2-3b-instruct:free",  # Fallback - faster
    "google/gemini-2.0-flash-exp:free",  # Alternative
    "qwen/qwen3-coder:free",  # Code-focused
    "deepseek/deepseek-r1-0528:free",  # Reasoning
]


@dataclass
class ModelStatus:
    """Track status of a model including cooldown."""

    model_id: str
    available: bool = True
    cooldown_until: float = 0.0  # Unix timestamp
    failure_count: int = 0
    last_success: float = 0.0
    total_requests: int = 0
    total_failures: int = 0

    def is_available(self) -> bool:
        """Check if model is currently available."""
        if not self.available:
            return False
        if self.cooldown_until > time.time():
            return False
        return True

    def mark_success(self) -> None:
        """Mark a successful request."""
        self.available = True
        self.failure_count = 0
        self.last_success = time.time()
        self.total_requests += 1

    def mark_failure(self, cooldown_seconds: int = 60) -> None:
        """Mark a failed request and set cooldown."""
        self.failure_count += 1
        self.total_failures += 1
        self.total_requests += 1

        # Exponential backoff: 60s, 120s, 240s, max 600s
        backoff = min(cooldown_seconds * (2 ** (self.failure_count - 1)), 600)
        self.cooldown_until = time.time() + backoff

        logger.warning(
            f"Model {self.model_id} marked unavailable, "
            f"cooldown {backoff}s (failures: {self.failure_count})"
        )

    def mark_rate_limited(self, retry_after: int | None = None) -> None:
        """Mark model as rate limited with specific cooldown."""
        cooldown = retry_after or 60
        self.cooldown_until = time.time() + cooldown
        self.total_failures += 1
        self.total_requests += 1

        logger.warning(
            f"Model {self.model_id} rate limited, cooldown {cooldown}s"
        )


class ModelPool:
    """Manage a pool of models with automatic failover."""

    def __init__(self, models: list[str] | None = None):
        """Initialize model pool.

        Args:
            models: List of model IDs. Defaults to FREE_MODELS.
        """
        self.models = models or FREE_MODELS.copy()
        self._status: dict[str, ModelStatus] = {
            model: ModelStatus(model_id=model) for model in self.models
        }
        self._current_index = 0

    def get_available_model(self) -> str | None:
        """Get next available model from pool.

        Returns:
            Model ID or None if all models are unavailable.
        """
        # Try starting from current index
        for _ in range(len(self.models)):
            model = self.models[self._current_index]
            status = self._status[model]

            if status.is_available():
                return model

            # Move to next model
            self._current_index = (self._current_index + 1) % len(self.models)

        # All models exhausted, check if any cooldown expired
        now = time.time()
        for model, status in self._status.items():
            if status.cooldown_until <= now:
                status.available = True
                return model

        return None

    def mark_success(self, model: str) -> None:
        """Mark successful request for model."""
        if model in self._status:
            self._status[model].mark_success()

    def mark_failure(self, model: str, cooldown: int = 60) -> None:
        """Mark failed request for model."""
        if model in self._status:
            self._status[model].mark_failure(cooldown)
            # Rotate to next model
            self._current_index = (self._current_index + 1) % len(self.models)

    def mark_rate_limited(self, model: str, retry_after: int | None = None) -> None:
        """Mark model as rate limited."""
        if model in self._status:
            self._status[model].mark_rate_limited(retry_after)
            # Rotate to next model immediately
            self._current_index = (self._current_index + 1) % len(self.models)

    def get_stats(self) -> dict[str, Any]:
        """Get pool statistics."""
        stats = {
            "total_models": len(self.models),
            "available_models": sum(1 for s in self._status.values() if s.is_available()),
            "models": {},
        }

        for model, status in self._status.items():
            stats["models"][model] = {
                "available": status.is_available(),
                "cooldown_remaining": max(0, status.cooldown_until - time.time()),
                "failure_count": status.failure_count,
                "total_requests": status.total_requests,
                "total_failures": status.total_failures,
            }

        return stats

    def reset(self) -> None:
        """Reset all model statuses."""
        for status in self._status.values():
            status.available = True
            status.cooldown_until = 0.0
            status.failure_count = 0
        self._current_index = 0


class OpenRouterConfig(BaseModel):
    """Configuration for OpenRouter API."""

    api_key: str = Field(default="")
    base_url: str = Field(default="https://openrouter.ai/api/v1")
    primary_model: str = Field(default="meta-llama/llama-3.3-70b-instruct:free")
    fallback_model: str = Field(default="meta-llama/llama-3.2-3b-instruct:free")
    timeout: int = Field(default=30)
    max_retries: int = Field(default=3)
    use_model_pool: bool = Field(default=True)

    @classmethod
    def from_env(cls) -> "OpenRouterConfig":
        """Load configuration from environment variables."""
        return cls(
            api_key=os.environ.get("OPENROUTER_API_KEY", ""),
            base_url=os.environ.get(
                "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
            ),
            primary_model=os.environ.get(
                "OPENROUTER_PRIMARY_MODEL", "meta-llama/llama-3.3-70b-instruct:free"
            ),
            fallback_model=os.environ.get(
                "OPENROUTER_FALLBACK_MODEL", "meta-llama/llama-3.2-3b-instruct:free"
            ),
            timeout=int(os.environ.get("OPENROUTER_TIMEOUT", "30")),
            max_retries=int(os.environ.get("OPENROUTER_MAX_RETRIES", "3")),
            use_model_pool=os.environ.get("OPENROUTER_USE_MODEL_POOL", "true").lower()
            == "true",
        )

    # Backward compatibility
    @property
    def model(self) -> str:
        """Alias for primary_model for backward compatibility."""
        return self.primary_model


class AIResponse(BaseModel):
    """Response from AI model."""

    content: str
    model: str
    usage: dict[str, int] = Field(default_factory=dict)
    raw_response: dict[str, Any] | None = None


class OpenRouterClient:
    """Client for OpenRouter API with automatic model switching."""

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

        # Initialize model pool if enabled
        if self.config.use_model_pool:
            # Build custom model list with primary and fallback first
            models = [self.config.primary_model, self.config.fallback_model]
            for m in FREE_MODELS:
                if m not in models:
                    models.append(m)
            self._model_pool = ModelPool(models)
        else:
            self._model_pool = None

    def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.1,
        max_tokens: int = 1024,
    ) -> AIResponse:
        """Send chat completion request with automatic model switching.

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model to use. If None and pool enabled, uses pool.
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate

        Returns:
            AIResponse with content and metadata

        Raises:
            OpenRouterError: If API call fails after all models exhausted
        """
        # If specific model requested or pool disabled, use legacy logic
        if model or not self._model_pool:
            return self._chat_with_fallback(
                messages, model or self.config.primary_model, temperature, max_tokens
            )

        # Use model pool with automatic switching
        return self._chat_with_pool(messages, temperature, max_tokens)

    def _chat_with_pool(
        self,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> AIResponse:
        """Chat using model pool with automatic switching on failures."""
        assert self._model_pool is not None  # Caller ensures pool exists

        pool = self._model_pool
        last_error: Exception | None = None
        models_tried = 0
        max_models = len(pool.models)

        while models_tried < max_models:
            current_model = pool.get_available_model()

            if not current_model:
                # All models exhausted
                logger.error("All models in pool are unavailable")
                break

            models_tried += 1

            try:
                logger.debug(f"Trying model: {current_model}")
                response = self._make_request(
                    messages=messages,
                    model=current_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )

                # Success - mark model as working
                pool.mark_success(current_model)
                return response

            except httpx.HTTPStatusError as e:
                last_error = e
                status_code = e.response.status_code

                if status_code == 429:
                    # Rate limited - extract retry-after if available
                    retry_after = e.response.headers.get("Retry-After")
                    retry_seconds = int(retry_after) if retry_after else 60
                    pool.mark_rate_limited(current_model, retry_seconds)
                    logger.warning(
                        f"Model {current_model} rate limited (429), "
                        f"switching to next model"
                    )
                elif status_code in (500, 502, 503, 504):
                    # Server error - temporary failure
                    pool.mark_failure(current_model, cooldown=30)
                    logger.warning(
                        f"Model {current_model} server error ({status_code}), "
                        f"switching to next model"
                    )
                else:
                    # Other errors (4xx) - mark failure with longer cooldown
                    pool.mark_failure(current_model, cooldown=120)
                    logger.warning(
                        f"Model {current_model} failed ({status_code}): {e}"
                    )

            except httpx.TimeoutException as e:
                last_error = e
                pool.mark_failure(current_model, cooldown=60)
                logger.warning(f"Model {current_model} timed out")

            except Exception as e:
                last_error = e
                pool.mark_failure(current_model, cooldown=120)
                logger.error(f"Model {current_model} unexpected error: {e}")

        # All models failed
        raise OpenRouterError(
            f"All models exhausted after trying {models_tried} models. "
            f"Last error: {last_error}"
        )

    def _chat_with_fallback(
        self,
        messages: list[dict[str, str]],
        model: str,
        temperature: float,
        max_tokens: int,
    ) -> AIResponse:
        """Legacy chat with simple fallback (when pool disabled)."""
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
                        logger.info(
                            f"Trying fallback model: {self.config.fallback_model}"
                        )
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

    def get_pool_stats(self) -> dict[str, Any] | None:
        """Get model pool statistics.

        Returns:
            Pool stats dict or None if pool disabled.
        """
        if self._model_pool:
            return self._model_pool.get_stats()
        return None

    def reset_pool(self) -> None:
        """Reset model pool state (clear cooldowns)."""
        if self._model_pool:
            self._model_pool.reset()
            logger.info("Model pool reset")

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self) -> "OpenRouterClient":
        return self

    def __exit__(self, *_: Any) -> None:
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


def get_pool_stats() -> dict[str, Any] | None:
    """Get model pool statistics from the default client."""
    return get_openrouter_client().get_pool_stats()


def reset_pool() -> None:
    """Reset model pool state on the default client."""
    get_openrouter_client().reset_pool()
