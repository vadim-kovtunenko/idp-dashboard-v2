from __future__ import annotations

from app.config.widgets import build_widget_registry, segment_options_by_widget
from app.domain.models import DashboardDataset
from app.services.filter_engine import ensure_valid_segment


def build_dashboard_payload(dataset: DashboardDataset) -> dict[str, object]:
    widget_configs = []
    segment_map = segment_options_by_widget()

    for widget in build_widget_registry():
        config = widget.model_dump(mode="json")
        if widget.widget_id in segment_map:
            config["filters"][1]["options_by_parent"] = segment_map[widget.widget_id]
            config["default_state"]["segment"] = ensure_valid_segment(
                widget.widget_id,
                config["default_state"]["direction"],
                config["default_state"].get("segment"),
            )
        widget_configs.append(config)

    return {
        "widget_configs": widget_configs,
        "data": dataset.model_dump(mode="json"),
        "meta": {
            "available_months": dataset.available_months,
            "default_month_range": {
                "start": dataset.available_months[-12] if len(dataset.available_months) >= 12 else None,
                "end": dataset.available_months[-1] if dataset.available_months else None,
            },
        },
    }
