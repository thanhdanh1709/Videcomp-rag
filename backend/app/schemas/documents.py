"""Schemas for document.jsonl / chunks.jsonl (TaiLieuKyThuat Muc 6.1)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Domain = Literal["legal", "medical"]


class DocumentMetadata(BaseModel):
    doc_number: str | None = None
    issued_date: str | None = None
    effective_date: str | None = None
    version: str | None = None


class Document(BaseModel):
    doc_id: str
    domain: Domain
    title: str = ""
    text: str
    source_url: str | None = None
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)


class ChunkMetadata(BaseModel):
    domain: Domain
    effective_date: str | None = None
    version: str | None = None


class Chunk(BaseModel):
    chunk_id: str
    doc_id: str
    parent_path: list[str] = Field(default_factory=list)
    text: str
    token_count: int
    source_url: str | None = None
    metadata: ChunkMetadata
