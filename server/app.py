"""Crew Chief Agent — FastAPI backend."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from art import lookup_nga_image
from art_trigger import should_include_art_card
from claude import ClaudeError, chat_completion, fallback_response
from config import Settings, load_settings
from prompt import build_greeting_user_message, build_system_prompt
from race_data import warm_race_data_cache
from race_log import log_note, log_question
from status import load_status
from visitors import (
    InvalidRelationship,
    VisitorError,
    VisitorNotFound,
    create_visitor,
    get_visitor,
    record_checkin,
)

settings: Settings = load_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    warm_race_data_cache(settings)
    yield


app = FastAPI(title="Crew Chief Agent", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VisitorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    relationship: str


class VisitorResponse(BaseModel):
    visitor_id: str
    name: str
    relationship: str


class ChatRequest(BaseModel):
    visitor_id: str
    message: str | None = None


class ChatResponse(BaseModel):
    reply: str
    harvey_status_snapshot: dict[str, Any]
    art_prompt: str | None = None
    art_image_url: str | None = None
    fallback: bool = False


class NoteCreate(BaseModel):
    visitor_id: str
    note_text: str = Field(min_length=1, max_length=2000)


class NoteResponse(BaseModel):
    ok: bool = True


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/ready")
def ready() -> dict[str, Any]:
    """Ops probe: config + data files (no Claude call — safe to poll)."""
    status = load_status(settings.status_path)
    key = settings.anthropic_api_key or ""
    return {
        "ok": True,
        "claude_configured": settings.claude_configured,
        "api_key_ascii": bool(key) and key.isascii(),
        "status_file_readable": settings.status_path.is_file(),
        "status_enabled": bool(status.get("enabled")),
        "data_stale": bool(status.get("data_stale")),
        "race_status": status.get("race_status", "unknown"),
    }


@app.get("/status")
def get_status() -> dict[str, Any]:
    return load_status(settings.status_path)


@app.post("/visitors", response_model=VisitorResponse)
def post_visitors(body: VisitorCreate) -> VisitorResponse:
    try:
        visitor = create_visitor(settings, name=body.name, relationship=body.relationship)
    except InvalidRelationship as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except VisitorError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err

    return VisitorResponse(
        visitor_id=visitor["id"],
        name=visitor["name"],
        relationship=visitor["relationship"],
    )


@app.post("/notes", response_model=NoteResponse)
def post_notes(body: NoteCreate) -> NoteResponse:
    try:
        visitor = get_visitor(settings, body.visitor_id)
    except VisitorNotFound as err:
        raise HTTPException(status_code=404, detail=str(err)) from err

    status = load_status(settings.status_path)
    harvey_mile = status.get("route_mile")
    mile_value: float | None = float(harvey_mile) if isinstance(harvey_mile, (int, float)) else None

    log_note(
        settings.notes_path,
        visitor_name=str(visitor.get("name", "")),
        relationship=str(visitor.get("relationship", "")),
        note_text=body.note_text,
        harvey_mile_at_time=mile_value,
    )
    return NoteResponse()


@app.post("/chat", response_model=ChatResponse)
def post_chat(body: ChatRequest) -> ChatResponse:
    try:
        visitor = get_visitor(settings, body.visitor_id)
    except VisitorNotFound as err:
        raise HTTPException(status_code=404, detail=str(err)) from err

    status = load_status(settings.status_path)
    harvey_mile = status.get("route_mile")
    if isinstance(harvey_mile, (int, float)):
        mile_value: float | None = float(harvey_mile)
    else:
        mile_value = None

    message = (body.message or "").strip()
    is_greeting = not message
    include_art = should_include_art_card(message)
    user_message = (
        build_greeting_user_message(visitor, status=status) if is_greeting else message
    )

    system = build_system_prompt(
        settings,
        status=status,
        visitor=visitor,
        include_art=include_art,
    )

    try:
        model_out = chat_completion(
            settings,
            system=system,
            user_message=user_message,
            require_art=include_art,
        )
        fallback = False
    except ClaudeError:
        model_out = fallback_response(settings, include_art=include_art)
        fallback = True

    reply = model_out["reply"]
    art_prompt: str | None = None
    if include_art:
        art_prompt = model_out.get("art_prompt") or (
            "Wanderer Above the Sea of Fog, Friedrich — still moving, still out here."
        )

    if message:
        log_question(
            settings.questions_path,
            visitor_name=str(visitor.get("name", "")),
            relationship=str(visitor.get("relationship", "")),
            harvey_mile_at_time=mile_value,
            message=message,
            response_summary=reply,
        )
    elif is_greeting:
        log_question(
            settings.questions_path,
            visitor_name=str(visitor.get("name", "")),
            relationship=str(visitor.get("relationship", "")),
            harvey_mile_at_time=mile_value,
            message="[session greeting]",
            response_summary=reply,
        )

    try:
        record_checkin(settings, body.visitor_id, harvey_mile=mile_value)
    except VisitorNotFound:
        pass

    return ChatResponse(
        reply=reply,
        harvey_status_snapshot=status,
        art_prompt=art_prompt,
        art_image_url=lookup_nga_image(settings, status) if art_prompt else None,
        fallback=fallback,
    )
