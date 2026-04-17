from fastapi.testclient import TestClient

from app.main import app


def test_dashboard_page_renders() -> None:
    with TestClient(app) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert "Dashboard" in response.text
    assert "UI Kit" in response.text
    assert 'data-tab-target="dashboard"' in response.text
    assert 'data-tab-target="ui-kit"' in response.text
    assert "Вызовы LLM сервисов" in response.text
    assert "Источники" in response.text
    assert "Тикеты" in response.text
    assert "Заведенные инициативы" in response.text
    assert "Инициативы в ПРОМе" in response.text
    assert 'data-filter-key="direction"' in response.text
    assert 'data-custom-select-key="direction"' in response.text
    assert 'data-custom-select-trigger' in response.text
    assert 'data-custom-select-menu' in response.text
    assert 'data-chart-type="line"' in response.text
    assert 'type="month"' in response.text
    assert "Направление" in response.text
    assert 'data-widget-trend-badge' in response.text
    assert 'data-widget-trend-value' in response.text
    assert 'data-period-preset="last_12_months"' in response.text
    assert 'data-period-preset="last_6_months"' in response.text
    assert 'data-period-preset="last_3_months"' in response.text
    assert 'data-period-preset="custom"' in response.text
    assert "12m" in response.text
    assert "6m" in response.text
    assert "3m" in response.text
    assert "Custom" in response.text
    assert 'data-overview-widget="initiatives_created"' in response.text
    assert 'data-overview-widget="initiatives_in_prod"' in response.text
    assert 'data-overview-widget="calls_count"' in response.text
    assert "Инициативы (общее)" in response.text
    assert "Инициативы в ПРОМе" in response.text
    assert "Количество вызовов" in response.text
    assert "Количество вызовов (текущий месяц)" not in response.text
    assert 'data-overview-period' not in response.text
    assert 'data-overview-note' not in response.text
    assert "Цветовые токены" in response.text
    assert "Продуктовый дашборд" in response.text
