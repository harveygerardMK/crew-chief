"""Optional Langfuse tracing for /chat — off unless keys are configured."""

from __future__ import annotations

import logging
from contextlib import AbstractContextManager, nullcontext
from typing import Any

from config import Settings

logger = logging.getLogger(__name__)


def _status_metadata(status: dict[str, Any]) -> dict[str, Any]:
    ctx = status.get("course_context") or {}
    gap = status.get("signal_gap") or {}
    return {
        "enabled": status.get("enabled"),
        "simulation": status.get("simulation"),
        "race_status": status.get("race_status"),
        "route_mile": status.get("route_mile"),
        "current_speed_mph": status.get("current_speed_mph"),
        "stale": status.get("stale"),
        "data_stale": status.get("data_stale"),
        "last_update_at": status.get("last_update_at"),
        "place_label": ctx.get("place_label"),
        "signal_gap_active": gap.get("active"),
        "signal_gap_summary": gap.get("summary"),
    }


def _visitor_metadata(visitor: dict[str, Any]) -> dict[str, Any]:
    return {
        "visitor_id": visitor.get("id"),
        "name": visitor.get("name"),
        "relationship": visitor.get("relationship"),
        "checkin_count": visitor.get("checkin_count"),
        "last_harvey_mile": visitor.get("last_harvey_mile"),
    }


class ChatTrace(AbstractContextManager["ChatTrace"]):
    """One Langfuse trace per /chat request."""

    def __init__(
        self,
        settings: Settings,
        *,
        visitor: dict[str, Any],
        status: dict[str, Any],
        user_message: str,
        is_greeting: bool,
    ) -> None:
        self.settings = settings
        self.visitor = visitor
        self.status = status
        self.user_message = user_message
        self.is_greeting = is_greeting
        self._span_cm: AbstractContextManager[Any] | None = None
        self._span: Any = None
        self._propagate_cm: AbstractContextManager[Any] | None = None
        self._enabled = settings.langfuse_configured
        self.trace_id: str | None = None

    def __enter__(self) -> ChatTrace:
        if not self._enabled:
            return self
        try:
            from langfuse import get_client, propagate_attributes

            langfuse = get_client()
            # Explicit trace input: user message only (not system prompt or API keys).
            self._span_cm = langfuse.start_as_current_observation(
                as_type="span",
                name="chat-response",
                input={
                    "user_message": self.user_message,
                    "is_greeting": self.is_greeting,
                },
                metadata={
                    "feature": "chat",
                    "environment": "crew-chief-agent",
                    "status": _status_metadata(self.status),
                    "visitor": _visitor_metadata(self.visitor),
                },
            )
            self._span = self._span_cm.__enter__()
            visitor_id = str(self.visitor.get("id") or "")
            relationship = str(self.visitor.get("relationship") or "unknown")
            self._propagate_cm = propagate_attributes(
                user_id=visitor_id or None,
                session_id=visitor_id or None,
                tags=["crew-chief", "chat", relationship],
                metadata={
                    "simulation": self.status.get("simulation"),
                    "route_mile": self.status.get("route_mile"),
                    "data_stale": self.status.get("data_stale"),
                },
            )
            self._propagate_cm.__enter__()
            self.trace_id = langfuse.get_current_trace_id()
        except Exception as err:  # noqa: BLE001 — tracing must never break chat
            logger.warning("Langfuse trace start failed: %s", err)
            self._enabled = False
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if not self._enabled:
            return None
        try:
            if self._propagate_cm is not None:
                self._propagate_cm.__exit__(exc_type, exc, tb)
            if self._span is not None and exc is not None:
                self._span.update(level="ERROR", status_message=str(exc))
            if self._span_cm is not None:
                return self._span_cm.__exit__(exc_type, exc, tb)
        except Exception as err:  # noqa: BLE001
            logger.warning("Langfuse trace end failed: %s", err)
        return None

    def record_fallback(self, *, reason: str, output: dict[str, str]) -> None:
        if not self._enabled:
            return
        try:
            from langfuse import get_client

            langfuse = get_client()
            with langfuse.start_as_current_observation(
                as_type="span",
                name="fallback-response",
                input={"reason": reason, "status": _status_metadata(self.status)},
            ) as span:
                span.update(output=output, metadata={"fallback": True})
            if self._span is not None:
                self._span.update(
                    metadata={"fallback": True, "fallback_reason": reason},
                )
        except Exception as err:  # noqa: BLE001
            logger.warning("Langfuse fallback record failed: %s", err)

    def record_result(
        self,
        *,
        reply: str,
        fallback: bool,
        art_prompt: str | None,
    ) -> None:
        if not self._enabled or self._span is None:
            return
        try:
            self._span.update(
                output={
                    "reply": reply,
                    "fallback": fallback,
                    "art_prompt": art_prompt,
                    "status_snapshot": _status_metadata(self.status),
                }
            )
        except Exception as err:  # noqa: BLE001
            logger.warning("Langfuse result record failed: %s", err)


def chat_trace(
    settings: Settings,
    *,
    visitor: dict[str, Any],
    status: dict[str, Any],
    user_message: str,
    is_greeting: bool,
) -> ChatTrace | nullcontext[None]:
    if not settings.langfuse_configured:
        return nullcontext()
    return ChatTrace(
        settings,
        visitor=visitor,
        status=status,
        user_message=user_message,
        is_greeting=is_greeting,
    )


def auth_check(settings: Settings) -> bool | None:
    if not settings.langfuse_configured:
        return None
    try:
        from langfuse import get_client

        return get_client().auth_check()
    except Exception:
        return False
