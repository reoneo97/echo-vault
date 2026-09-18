"""LLM call retry with provider fallback.

When a model call fails with a transient error (rate limit, timeout, provider
outage), retry with the next model ID in the fallback list. The fallback list
is usually the same model routed through a different OpenRouter provider, e.g.:
  primary:   "qwen/qwen3-32b"
  fallback:  "qwen/qwen3-32b:nitro", "qwen/qwen3-32b:floor"

This is separate from the routes-level retry (which retries the whole pipeline).
This operates at the single agent.run() level.
"""
from __future__ import annotations

import logging

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

logger = logging.getLogger(__name__)

# Errors that indicate a permanent failure — don't retry these.
_PERMANENT_ERROR_SUBSTRINGS = [
    "invalid_api_key",
    "insufficient_quota",
    "model_not_found",
    "context_length_exceeded",
    "invalid request",
]


def _is_permanent(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(s in msg for s in _PERMANENT_ERROR_SUBSTRINGS)


def make_openrouter_model(model_id: str, api_key: str) -> OpenAIChatModel:
    return OpenAIChatModel(
        model_id,
        provider=OpenAIProvider(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        ),
    )


async def run_with_fallback(
    agent: Agent,
    prompt,
    *,
    fallback_model_ids: list[str],
    api_key: str,
    **kwargs,
):
    """Run agent.run(prompt) trying the agent's default model first, then each fallback.

    kwargs are passed through to agent.run() on every attempt (deps, model_settings, etc.).
    Raises the last exception if all attempts fail.
    """
    last_exc: Exception | None = None

    # attempt 0: use the agent's already-configured model (no override)
    # attempts 1+: override with the fallback model
    attempts = [(None, "default")] + [
        (make_openrouter_model(m, api_key), m) for m in fallback_model_ids
    ]

    for i, (model_override, label) in enumerate(attempts):
        try:
            if model_override is None:
                return await agent.run(prompt, **kwargs)
            else:
                logger.info(
                    "LLM fallback attempt %d/%d — model=%s",
                    i, len(attempts) - 1, label,
                )
                return await agent.run(prompt, model=model_override, **kwargs)
        except Exception as exc:
            if _is_permanent(exc):
                logger.error("Permanent LLM error (model=%s): %s", label, exc)
                raise
            last_exc = exc
            logger.warning(
                "LLM call failed (model=%s, attempt %d/%d): %s — trying next",
                label, i + 1, len(attempts), exc,
            )

    raise last_exc  # type: ignore[misc]
