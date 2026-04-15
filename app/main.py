from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.routes.pages import router as pages_router
from app.services.chart_payloads import build_dashboard_payload
from app.services.data_loader import DashboardDataLoader
from app.settings import STATIC_DIR


@asynccontextmanager
async def lifespan(app: FastAPI):
    dataset = DashboardDataLoader().load()
    app.state.dashboard_payload = build_dashboard_payload(dataset)
    yield


app = FastAPI(
    title="RAG Product Dashboard",
    description="Local MVP dashboard for monitoring the product metrics of the RAG platform.",
    lifespan=lifespan,
)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.include_router(pages_router)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
