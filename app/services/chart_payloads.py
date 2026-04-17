from __future__ import annotations

from app.config.widgets import build_widget_registry, segment_options_by_widget
from app.domain.enums import MonthlyMetricId
from app.domain.models import DashboardDataset
from app.services.filter_engine import ensure_valid_segment


OVERVIEW_CARD_SPECS = [
    {
        "widget_id": MonthlyMetricId.INITIATIVES_CREATED.value,
        "label": "Инициативы (общее)",
        "tone": "mist",
    },
    {
        "widget_id": MonthlyMetricId.INITIATIVES_IN_PROD.value,
        "label": "Инициативы в ПРОМе",
        "tone": "paper",
    },
    {
        "widget_id": MonthlyMetricId.CALLS_COUNT.value,
        "label": "Количество вызовов",
        "tone": "accent",
    },
]


def format_metric_value(metric_id: str, value: int) -> str:
    if metric_id == MonthlyMetricId.CALLS_COUNT.value:
        if value == 0:
            return "0"
        if value < 1_000_000:
            thousands = value / 1_000
            return f"{thousands:.1f}k" if thousands % 1 else f"{int(thousands)}k"
        millions = value / 1_000_000
        return f"{millions:.1f}M" if millions % 1 else f"{int(millions)}M"
    return f"{value:,}".replace(",", " ")


def build_overview_cards(
    dataset: DashboardDataset, widget_configs: list[dict[str, object]]
) -> list[dict[str, str]]:
    widgets_by_id = {widget["widget_id"]: widget for widget in widget_configs}
    overview_cards: list[dict[str, str]] = []

    for spec in OVERVIEW_CARD_SPECS:
        widget = widgets_by_id[spec["widget_id"]]
        state = widget["default_state"]
        points = sorted(
            (
                record
                for record in dataset.monthly_metrics
                if record.metric_id == spec["widget_id"]
                and record.direction == state["direction"]
                and record.segment == state["segment"]
            ),
            key=lambda record: record.month,
        )
        latest = points[-1]
        previous = points[-2] if len(points) > 1 else points[-1]
        delta = latest.value - previous.value
        if previous.value == 0:
            delta_percent = 100.0 if latest.value else 0.0
        else:
            delta_percent = abs(delta / previous.value) * 100
        change_direction = "up" if delta > 0 else "down" if delta < 0 else "flat"
        change_arrow = "↑" if delta > 0 else "↓" if delta < 0 else "→"

        overview_cards.append(
            {
                "widget_id": spec["widget_id"],
                "label": spec["label"],
                "tone": spec["tone"],
                "value": format_metric_value(spec["widget_id"], latest.value),
                "change_label": f"{delta_percent:.1f}%",
                "change_direction": change_direction,
                "change_arrow": change_arrow,
            }
        )

    return overview_cards


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
        "overview_cards": build_overview_cards(dataset, widget_configs),
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
