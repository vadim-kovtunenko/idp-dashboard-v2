from __future__ import annotations

from app.config.widgets import MONTHLY_SEGMENTS


def list_segment_options(widget_id: str, direction: str) -> list[str]:
    return [option.value for option in MONTHLY_SEGMENTS[widget_id][direction]]


def ensure_valid_segment(widget_id: str, direction: str, segment: str | None) -> str:
    options = list_segment_options(widget_id, direction)
    if segment in options:
        return segment
    return options[0]


def normalize_month_bounds(
    available_months: list[str],
    period_mode: str,
    date_from: str | None,
    date_to: str | None,
) -> tuple[str | None, str | None]:
    if not available_months:
        return None, None

    if period_mode != "custom" or not date_from or not date_to:
        recent_months = available_months[-12:]
        return recent_months[0], recent_months[-1]

    start = min(date_from, date_to)
    end = max(date_from, date_to)
    bounded_months = [month for month in available_months if start <= month <= end]
    if not bounded_months:
        recent_months = available_months[-12:]
        return recent_months[0], recent_months[-1]
    return bounded_months[0], bounded_months[-1]
