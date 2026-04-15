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
    assert "Количество заведенных инициатив" in response.text
    assert 'data-filter-key="direction"' in response.text
    assert 'data-chart-type="line"' in response.text
    assert 'type="month"' in response.text
    assert "Направление" in response.text
    assert "Цветовые токены" in response.text
    assert "Продуктовый дашборд" in response.text
    assert 'data-overview-widget=' not in response.text
