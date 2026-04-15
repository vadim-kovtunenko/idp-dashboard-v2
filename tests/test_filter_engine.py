from app.services.filter_engine import ensure_valid_segment, list_segment_options, normalize_month_bounds


def test_list_segment_options_depends_on_direction() -> None:
    options = list_segment_options("calls_count", "GigaSearch")

    assert options == ["common", "alpha_common", "alpha_b2c_sbol", "sigma"]


def test_ensure_valid_segment_falls_back_to_first_value() -> None:
    segment = ensure_valid_segment("initiatives_created", "Summarization", "alpha_sbol")

    assert segment == "common"


def test_normalize_month_bounds_respects_valid_custom_period() -> None:
    months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"]

    start, end = normalize_month_bounds(months, "custom", "2025-12", "2026-03")

    assert start == "2025-12"
    assert end == "2026-03"
