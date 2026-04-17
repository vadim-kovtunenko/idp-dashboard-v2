from __future__ import annotations

import json

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.settings import TEMPLATES_DIR


router = APIRouter()
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@router.get("/", response_class=HTMLResponse)
async def dashboard_page(request: Request) -> HTMLResponse:
    payload = request.app.state.dashboard_payload
    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={
            "dashboard_payload_json": json.dumps(payload, ensure_ascii=False),
            "overview_cards": payload["overview_cards"],
            "widget_configs": payload["widget_configs"],
            "dashboard_meta": payload["meta"],
        },
    )
