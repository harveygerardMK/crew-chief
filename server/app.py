"""Crew Chief Agent — FastAPI backend."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from claude import ClaudeError, chat_completion, fallback_response
from config import Settings, load_settings
from prompt import build_greeting_user_message, build_system_prompt
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

app = FastAPI(title="Crew Chief Agent", version="0.1.0")

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
    art_prompt: str
    fallback: bool = False


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


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
    user_message = build_greeting_user_message(visitor) if is_greeting else message

    system = build_system_prompt(settings, status=status, visitor=visitor)

    try:
        model_out = chat_completion(settings, system=system, user_message=user_message)
        fallback = False
    except ClaudeError:
        model_out = fallback_response(settings)
        fallback = True

    try:
        record_checkin(settings, body.visitor_id, harvey_mile=mile_value)
    except VisitorNotFound:
        pass

    return ChatResponse(
        reply=model_out["reply"],
        harvey_status_snapshot=status,
        art_prompt=model_out["art_prompt"],
        fallback=fallback,
    )
