"""Hàng đợi và điều phối tác vụ nền (Background Task Queue) cho ViDecomp-RAG.

Hỗ trợ xử lý bất đồng bộ các tác vụ nặng (cắt chunk, trích xuất hàng trăm trang PDF,
build index) kèm thanh tiến độ 0% -> 100% qua Server-Sent Events (SSE) hoặc Polling,
ngăn chặn nghẽn main thread của FastAPI.
"""
from __future__ import annotations

import asyncio
import concurrent.futures
import datetime as dt
import logging
import time
import uuid
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)


class TaskStatus:
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskRecord:
    def __init__(
        self,
        task_id: str,
        name: str,
        status: str = TaskStatus.PENDING,
        progress: float = 0.0,
        stage: str = "Khởi tạo tác vụ...",
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ):
        self.task_id = task_id
        self.name = name
        self.status = status
        self.progress = progress
        self.stage = stage
        self.result = result
        self.error = error
        self.created_at = time.time()
        self.updated_at = time.time()
        # Các hàng đợi asyncio.Queue để broadcast SSE tới các subscriber đang mở kết nối
        self._subscribers: list[asyncio.Queue] = []

    def to_dict(self) -> dict[str, Any]:
        return {
            "task_id": self.task_id,
            "name": self.name,
            "status": self.status,
            "progress": round(self.progress, 1),
            "stage": self.stage,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class TaskManager:
    """Bộ quản lý tác vụ nền với ThreadPoolExecutor và SSE broadcasting."""

    def __init__(self, max_workers: int = 4, ttl_seconds: int = 3600):
        self._tasks: dict[str, TaskRecord] = {}
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_workers, thread_name_prefix="videcomp-task-worker"
        )
        self._ttl_seconds = ttl_seconds
        self._lock = asyncio.Lock()

    def create_task(self, name: str) -> TaskRecord:
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        record = TaskRecord(task_id=task_id, name=name)
        self._tasks[task_id] = record
        self._cleanup_old_tasks()
        return record

    def get_task(self, task_id: str) -> TaskRecord | None:
        return self._tasks.get(task_id)

    def update_progress(self, task_id: str, progress: float, stage: str):
        record = self._tasks.get(task_id)
        if not record:
            return
        record.progress = max(0.0, min(100.0, progress))
        record.stage = stage
        record.status = TaskStatus.PROCESSING
        record.updated_at = time.time()
        self._broadcast(record)

    def complete_task(self, task_id: str, result: dict[str, Any]):
        record = self._tasks.get(task_id)
        if not record:
            return
        record.progress = 100.0
        record.stage = "Hoàn tất thành công!"
        record.status = TaskStatus.COMPLETED
        record.result = result
        record.updated_at = time.time()
        self._broadcast(record)

    def fail_task(self, task_id: str, error: str):
        record = self._tasks.get(task_id)
        if not record:
            return
        record.status = TaskStatus.FAILED
        record.stage = f"Thất bại: {error}"
        record.error = error
        record.updated_at = time.time()
        self._broadcast(record)

    def _broadcast(self, record: TaskRecord):
        data = record.to_dict()
        for q in list(record._subscribers):
            try:
                q.put_nowait(data)
            except Exception:
                pass

    def run_in_background(
        self,
        task_id: str,
        target_fn: Callable[..., Any],
        *args: Any,
        **kwargs: Any,
    ):
        """Đưa tác vụ chạy vào worker thread pool mà không chặn luồng chính."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = None

        def _dispatch(fn: Callable[..., Any], *a: Any):
            if loop and loop.is_running():
                loop.call_soon_threadsafe(fn, *a)
            else:
                fn(*a)

        def _worker():
            try:
                _dispatch(self.update_progress, task_id, 2.0, "Bắt đầu tiến trình nền...")
                result = target_fn(
                    *args,
                    progress_callback=lambda p, msg: _dispatch(
                        self.update_progress, task_id, p, msg
                    ),
                    **kwargs,
                )
                _dispatch(self.complete_task, task_id, result)
            except Exception as exc:
                logger.exception("Tác vụ nền %s gặp lỗi: %s", task_id, exc)
                _dispatch(self.fail_task, task_id, str(exc))

        self._executor.submit(_worker)

    async def subscribe(self, task_id: str):
        """Tạo generator SSE stream đẩy cập nhật liên tục cho task."""
        record = self._tasks.get(task_id)
        if not record:
            return

        queue: asyncio.Queue = asyncio.Queue()
        record._subscribers.append(queue)
        try:
            # Gửi trạng thái hiện thời trước
            yield record.to_dict()

            # Nếu task đã xong hoặc lỗi từ trước, kết thúc luôn
            if record.status in (TaskStatus.COMPLETED, TaskStatus.FAILED):
                return

            while True:
                data = await queue.get()
                yield data
                if data["status"] in (TaskStatus.COMPLETED, TaskStatus.FAILED):
                    break
        finally:
            if queue in record._subscribers:
                record._subscribers.remove(queue)

    def _cleanup_old_tasks(self):
        now = time.time()
        expired = [
            tid
            for tid, t in self._tasks.items()
            if now - t.created_at > self._ttl_seconds
            and t.status in (TaskStatus.COMPLETED, TaskStatus.FAILED)
        ]
        for tid in expired:
            del self._tasks[tid]


# Instance Singleton dùng chung cho toàn bộ ứng dụng FastAPI
task_manager = TaskManager()
