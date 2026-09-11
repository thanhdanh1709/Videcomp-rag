"""Semantic Cache Engine (Bộ đệm Ngữ nghĩa cho ViDecomp-RAG).

Sử dụng SQLite để lưu trữ bền vững câu hỏi, câu trả lời đã kiểm chứng và vector embedding chuẩn hóa.
Tìm kiếm độ tương đồng Cosine (Inner Product trên vector L2-normalized) trong bộ nhớ RAM cực nhanh (< 15ms).
Khi câu hỏi mới tương đồng nghĩa (Cosine similarity >= threshold, mặc định 0.93) với câu hỏi cũ đã được kiểm chứng,
hệ thống trả về kết quả ngay lập tức mà không cần gọi lại LLM, tiết kiệm 40–70% chi phí API.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

import numpy as np

from .config import settings
from .embedding_provider import EmbeddingProvider, get_embedding_provider

logger = logging.getLogger(__name__)


class SemanticCache:
    """Bộ đệm ngữ nghĩa kết hợp SQLite + In-memory Cosine Similarity Vector Index."""

    def __init__(
        self,
        db_path: str | None = None,
        embedder: EmbeddingProvider | None = None,
        threshold: float | None = None,
    ):
        self.db_path = Path(db_path or settings.semantic_cache_db)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._embedder = embedder
        self.threshold = threshold if threshold is not None else settings.semantic_cache_threshold
        self._lock = threading.RLock()

        self._entries: list[dict[str, Any]] = []
        self._embeddings: np.ndarray = np.empty((0, 0), dtype=np.float32)

        self._init_db()
        self._load_cache()

    @property
    def embedder(self) -> EmbeddingProvider:
        if self._embedder is None:
            self._embedder = get_embedding_provider()
        return self._embedder

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Tạo bảng lưu trữ nếu chưa tồn tại."""
        with self._lock, self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS semantic_cache_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    question TEXT NOT NULL,
                    domain TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    embedding BLOB NOT NULL,
                    result_json TEXT NOT NULL,
                    hit_count INTEGER DEFAULT 0,
                    created_at REAL NOT NULL,
                    last_hit_at REAL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_cache_domain ON semantic_cache_entries(domain)")
            conn.commit()

    def _load_cache(self) -> None:
        """Nạp toàn bộ vector và metadata từ SQLite vào RAM khi khởi động.
        
        Tự động lọc các bản ghi có số chiều vector khớp với mô hình Embedding hiện tại.
        """
        with self._lock, self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT id, question, domain, mode, embedding, result_json, hit_count, created_at, last_hit_at
                FROM semantic_cache_entries
                ORDER BY id ASC
                """
            )
            rows = cur.fetchall()

        current_dim = self.embedder.dim
        self._entries = []
        vecs: list[np.ndarray] = []

        for r in rows:
            vec = np.frombuffer(r["embedding"], dtype=np.float32)
            if len(vec) != current_dim:
                # Bỏ qua bản ghi cũ thuộc về mô hình embedding có chiều vector khác
                continue

            # Chuẩn hóa L2 vector
            norm = np.linalg.norm(vec)
            if norm > 1e-9:
                vec = vec / norm
            vecs.append(vec)
            self._entries.append(
                {
                    "id": r["id"],
                    "question": r["question"],
                    "domain": r["domain"],
                    "mode": r["mode"],
                    "result_json": r["result_json"],
                    "hit_count": r["hit_count"],
                    "created_at": r["created_at"],
                    "last_hit_at": r["last_hit_at"],
                }
            )

        if vecs:
            self._embeddings = np.vstack(vecs).astype(np.float32)
        else:
            self._embeddings = np.empty((0, current_dim), dtype=np.float32)

        logger.info("SemanticCache loaded %d active entries (dim=%d) from %s", len(self._entries), current_dim, self.db_path)

    def reload_cache(self) -> None:
        """Tải lại bộ nhớ đệm khi chuyển đổi mô hình embedding."""
        with self._lock:
            self._embedder = None  # reset để lấy embedder mới nhất
            self._load_cache()


    def lookup(
        self,
        question: str,
        domain: str = "law",
        mode: str = "videcomp_full",
        threshold: float | None = None,
    ) -> tuple[dict[str, Any] | None, float, float]:
        """Tìm kiếm câu hỏi tương đồng ngữ nghĩa.

        Returns:
            (result_dict, similarity_score, latency_ms)
        """
        start_time = time.perf_counter()
        active_threshold = threshold if threshold is not None else self.threshold

        if not settings.semantic_cache_enabled:
            return None, 0.0, (time.perf_counter() - start_time) * 1000

        with self._lock:
            n_entries = len(self._entries)
            if n_entries == 0 or self._embeddings.size == 0:
                return None, 0.0, (time.perf_counter() - start_time) * 1000

            # Tính vector embedding cho câu hỏi đến
            q_vec = self.embedder.embed([question])[0].astype(np.float32)
            if self._embeddings.shape[1] != len(q_vec):
                logger.warning("Vector dimension mismatch: cache has %d, embedder has %d. Reloading cache.", self._embeddings.shape[1], len(q_vec))
                self._load_cache()
                if self._embeddings.size == 0 or self._embeddings.shape[1] != len(q_vec):
                    return None, 0.0, (time.perf_counter() - start_time) * 1000

            norm = np.linalg.norm(q_vec)
            if norm > 1e-9:
                q_vec = q_vec / norm

            # Tính Cosine similarity: (N, dim) dot (dim,) -> (N,)
            sims = np.dot(self._embeddings, q_vec)

            # Lọc theo domain: ưu tiên tìm trong cùng domain
            domain_mask = np.array([e["domain"] == domain for e in self._entries], dtype=bool)
            if np.any(domain_mask):
                valid_indices = np.where(domain_mask)[0]
                masked_sims = sims[valid_indices]
                best_sub_idx = int(np.argmax(masked_sims))
                best_idx = int(valid_indices[best_sub_idx])
                best_sim = float(sims[best_idx])
            else:
                best_idx = int(np.argmax(sims))
                best_sim = float(sims[best_idx])

            latency_ms = (time.perf_counter() - start_time) * 1000

            if best_sim >= active_threshold:
                entry = self._entries[best_idx]
                entry_id = entry["id"]

                # Cập nhật số lượt trúng hit_count
                now = time.time()
                entry["hit_count"] += 1
                entry["last_hit_at"] = now
                try:
                    with self._get_connection() as conn:
                        conn.execute(
                            "UPDATE semantic_cache_entries SET hit_count = hit_count + 1, last_hit_at = ? WHERE id = ?",
                            (now, entry_id),
                        )
                        conn.commit()
                except Exception as ex:
                    logger.warning("Failed to update cache hit count in SQLite: %s", ex)

                # Parse kết quả đã lưu
                try:
                    result_data = json.loads(entry["result_json"])
                except Exception:
                    result_data = {"final_answer": entry["result_json"]}

                result_data["is_cached"] = True
                result_data["cache_similarity"] = round(best_sim, 4)
                result_data["cached_question"] = entry["question"]
                result_data["latency_ms"] = round(latency_ms, 2)

                logger.info(
                    "⚡ Semantic Cache HIT (sim=%.4f >= %.2f) in %.2fms for query: '%s' (matched: '%s')",
                    best_sim,
                    active_threshold,
                    latency_ms,
                    question[:60],
                    entry["question"][:60],
                )
                return result_data, best_sim, latency_ms

            return None, best_sim, latency_ms

    def store(
        self,
        question: str,
        domain: str,
        mode: str,
        result: dict[str, Any] | Any,
        embedding: np.ndarray | None = None,
    ) -> None:
        """Lưu một câu hỏi và câu trả lời đã được kiểm chứng vào Semantic Cache."""
        if not settings.semantic_cache_enabled:
            return

        # Chuyển đổi result sang dict / json
        if hasattr(result, "model_dump"):
            result_dict = result.model_dump()
        elif isinstance(result, dict):
            result_dict = result
        else:
            result_dict = {"final_answer": str(result)}

        result_json = json.dumps(result_dict, ensure_ascii=False)

        # Tính embedding nếu chưa có
        if embedding is None:
            vec = self.embedder.embed([question])[0].astype(np.float32)
        else:
            vec = embedding.astype(np.float32)

        norm = np.linalg.norm(vec)
        if norm > 1e-9:
            vec = vec / norm

        emb_bytes = vec.tobytes()
        now = time.time()

        with self._lock:
            # Kiểm tra xem câu hỏi y hệt đã có trong cache chưa
            for idx, entry in enumerate(self._entries):
                if entry["question"].strip().lower() == question.strip().lower() and entry["domain"] == domain:
                    # Cập nhật bản ghi cũ
                    entry["result_json"] = result_json
                    entry["mode"] = mode
                    if self._embeddings.size > 0 and idx < self._embeddings.shape[0]:
                        self._embeddings[idx] = vec
                    with self._get_connection() as conn:
                        conn.execute(
                            "UPDATE semantic_cache_entries SET result_json = ?, mode = ?, embedding = ? WHERE id = ?",
                            (result_json, mode, emb_bytes, entry["id"]),
                        )
                        conn.commit()
                    return

            # Thêm bản ghi mới
            with self._get_connection() as conn:
                cur = conn.execute(
                    """
                    INSERT INTO semantic_cache_entries (question, domain, mode, embedding, result_json, hit_count, created_at)
                    VALUES (?, ?, ?, ?, ?, 0, ?)
                    """,
                    (question, domain, mode, emb_bytes, result_json, now),
                )
                conn.commit()
                new_id = cur.lastrowid

            self._entries.append(
                {
                    "id": new_id,
                    "question": question,
                    "domain": domain,
                    "mode": mode,
                    "result_json": result_json,
                    "hit_count": 0,
                    "created_at": now,
                    "last_hit_at": None,
                }
            )

            if self._embeddings.size == 0 or self._embeddings.shape[1] != len(vec):
                self._embeddings = np.array([vec], dtype=np.float32)
            else:
                self._embeddings = np.vstack([self._embeddings, vec]).astype(np.float32)

            logger.info("SemanticCache stored entry id=%s (total entries=%d)", new_id, len(self._entries))

    def get_stats(self) -> dict[str, Any]:
        """Thống kê hiệu quả hoạt động của bộ đệm."""
        with self._lock:
            total_entries = len(self._entries)
            total_hits = sum(e.get("hit_count", 0) for e in self._entries)
            # Giả định trung bình 1 lần gọi multi-hop Q3 tốn khoảng $0.015 API token
            saved_cost_usd = round(total_hits * 0.015, 3)
            hit_rate_pct = round((total_hits / max(1, total_hits + total_entries)) * 100, 1)

            return {
                "enabled": settings.semantic_cache_enabled,
                "threshold": self.threshold,
                "total_entries": total_entries,
                "total_hits": total_hits,
                "hit_rate_pct": hit_rate_pct,
                "saved_cost_usd": saved_cost_usd,
                "db_path": str(self.db_path),
            }

    def clear(self) -> None:
        """Xóa sạch bộ đệm ngữ nghĩa."""
        with self._lock:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM semantic_cache_entries")
                conn.commit()
            self._entries = []
            self._embeddings = np.empty((0, 0), dtype=np.float32)
            logger.info("SemanticCache cleared all entries.")

    def set_threshold(self, threshold: float) -> None:
        """Cập nhật ngưỡng Cosine similarity."""
        with self._lock:
            self.threshold = float(threshold)
            settings.semantic_cache_threshold = float(threshold)


_instance: SemanticCache | None = None
_instance_lock = threading.Lock()


def get_semantic_cache() -> SemanticCache:
    global _instance
    with _instance_lock:
        if _instance is None:
            _instance = SemanticCache()
        return _instance
