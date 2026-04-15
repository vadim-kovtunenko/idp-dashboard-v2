from app.services.chart_payloads import build_dashboard_payload
from app.services.data_loader import DashboardDataLoader


def test_data_loader_expands_monthly_series() -> None:
    dataset = DashboardDataLoader().load()

    assert len(dataset.monthly_metrics) == 540
    assert len(dataset.source_distribution) == 10
    assert len(dataset.tickets) == 28
    assert dataset.available_months[0] == "2024-11"
    assert dataset.available_months[-1] == "2026-04"


def test_dashboard_payload_contains_five_widgets() -> None:
    dataset = DashboardDataLoader().load()
    payload = build_dashboard_payload(dataset)

    assert len(payload["widget_configs"]) == 5
    assert payload["meta"]["default_month_range"] == {
        "start": "2025-05",
        "end": "2026-04",
    }
