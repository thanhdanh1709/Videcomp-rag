from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .db.session import init_db

app = FastAPI(
    title="ViDecomp-RAG",
    description=(
        "Query Decomposition cho Multi-hop QA tren du lieu tieng Viet chuyen nganh "
        "(phap luat / y te)."
    ),
    version="0.1.0",
)

# Cho phep frontend dashboard (Vite dev server / build tinh) goi API tu origin
# khac - UI khong bao gio goi truc tiep DB/LLM, chi qua lop API nay.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
def _on_startup() -> None:
    init_db()
