"""Initialize Langfuse + Anthropic OpenTelemetry instrumentation."""

from __future__ import annotations

import logging
import os

from config import Settings

logger = logging.getLogger(__name__)

_instrumentor_ready = False


def init_langfuse_tracing(settings: Settings) -> None:
    """Enable Langfuse tracing when keys are configured.

    Must run after load_dotenv and before the first Anthropic client is created.
    Uses AnthropicInstrumentor so generations capture model, tokens, and prompts
    automatically (preferred over manual generation spans).
    """
    global _instrumentor_ready
    if not settings.langfuse_configured or _instrumentor_ready:
        return

    try:
        if settings.langfuse_public_key:
            os.environ["LANGFUSE_PUBLIC_KEY"] = settings.langfuse_public_key
        if settings.langfuse_secret_key:
            os.environ["LANGFUSE_SECRET_KEY"] = settings.langfuse_secret_key
        os.environ["LANGFUSE_BASE_URL"] = settings.langfuse_base_url

        from opentelemetry.instrumentation.anthropic import AnthropicInstrumentor

        AnthropicInstrumentor().instrument()
        _instrumentor_ready = True
        logger.info("Langfuse Anthropic instrumentation enabled")
    except Exception as err:  # noqa: BLE001 — tracing must never break the app
        logger.warning("Langfuse instrumentation init failed: %s", err)
