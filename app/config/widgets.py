from __future__ import annotations

from app.domain.enums import ChartType, Direction
from app.domain.models import AxisConfig, FilterConfig, FilterOption, WidgetConfig


def series_key(direction: str, segment: str) -> str:
    return f"{direction}__{segment}"


DIRECTION_OPTIONS = [
    FilterOption(value=Direction.GIGA_SEARCH.value, label="GigaSearch"),
    FilterOption(value=Direction.GIGA_QUERY.value, label="GigaQuery"),
    FilterOption(value=Direction.SUMMARIZATION.value, label="Summarization"),
]

MONTHLY_SEGMENTS = {
    "initiatives_created": {
        Direction.GIGA_SEARCH.value: [
            FilterOption(value="common", label="common"),
            FilterOption(value="alpha_common", label="alpha_common"),
            FilterOption(value="alpha_sbol", label="alpha_sbol"),
            FilterOption(value="sigma", label="sigma"),
        ],
        Direction.GIGA_QUERY.value: [
            FilterOption(value="common", label="common"),
            FilterOption(value="alpha", label="alpha"),
            FilterOption(value="sigma", label="sigma"),
        ],
        Direction.SUMMARIZATION.value: [
            FilterOption(value="common", label="common"),
            FilterOption(value="alpha", label="alpha"),
            FilterOption(value="sigma", label="sigma"),
        ],
    },
    "initiatives_in_prod": {
        Direction.GIGA_SEARCH.value: [
            FilterOption(value="common", label="common"),
            FilterOption(value="alpha_common", label="alpha_common"),
            FilterOption(value="alpha_sbol", label="alpha_sbol"),
            FilterOption(value="sigma", label="sigma"),
        ],
        Direction.GIGA_QUERY.value: [
            FilterOption(value="common", label="common"),
            FilterOption(value="alpha", label="alpha"),
            FilterOption(value="sigma", label="sigma"),
        ],
        Direction.SUMMARIZATION.value: [
            FilterOption(value="common", label="common"),
            FilterOption(value="alpha", label="alpha"),
            FilterOption(value="sigma", label="sigma"),
        ],
    },
    "calls_count": {
        Direction.GIGA_SEARCH.value: [
            FilterOption(value="common", label="common"),
            FilterOption(value="alpha_common", label="alpha_common"),
            FilterOption(value="alpha_b2c_sbol", label="alpha_b2c_sbol"),
            FilterOption(value="sigma", label="sigma"),
        ],
        Direction.GIGA_QUERY.value: [
            FilterOption(value="common", label="common"),
            FilterOption(value="alpha", label="alpha"),
            FilterOption(value="sigma", label="sigma"),
        ],
        Direction.SUMMARIZATION.value: [
            FilterOption(value="common", label="common"),
            FilterOption(value="alpha", label="alpha"),
            FilterOption(value="sigma", label="sigma"),
        ],
    },
}

MONTHLY_AXIS = {
    "initiatives_created": {
        series_key("GigaSearch", "common"): AxisConfig(maximum=100, interval=10),
        series_key("GigaSearch", "alpha_common"): AxisConfig(maximum=50, interval=10),
        series_key("GigaSearch", "alpha_sbol"): AxisConfig(maximum=50, interval=10),
        series_key("GigaSearch", "sigma"): AxisConfig(maximum=50, interval=10),
        series_key("GigaQuery", "common"): AxisConfig(maximum=50, interval=10),
        series_key("GigaQuery", "alpha"): AxisConfig(maximum=20, interval=5),
        series_key("GigaQuery", "sigma"): AxisConfig(maximum=20, interval=5),
        series_key("Summarization", "common"): AxisConfig(maximum=50, interval=10),
        series_key("Summarization", "alpha"): AxisConfig(maximum=20, interval=5),
        series_key("Summarization", "sigma"): AxisConfig(maximum=20, interval=5),
    },
    "initiatives_in_prod": {
        series_key("GigaSearch", "common"): AxisConfig(maximum=100, interval=10),
        series_key("GigaSearch", "alpha_common"): AxisConfig(maximum=50, interval=10),
        series_key("GigaSearch", "alpha_sbol"): AxisConfig(maximum=50, interval=10),
        series_key("GigaSearch", "sigma"): AxisConfig(maximum=50, interval=10),
        series_key("GigaQuery", "common"): AxisConfig(maximum=50, interval=10),
        series_key("GigaQuery", "alpha"): AxisConfig(maximum=20, interval=5),
        series_key("GigaQuery", "sigma"): AxisConfig(maximum=20, interval=5),
        series_key("Summarization", "common"): AxisConfig(maximum=50, interval=10),
        series_key("Summarization", "alpha"): AxisConfig(maximum=20, interval=5),
        series_key("Summarization", "sigma"): AxisConfig(maximum=20, interval=5),
    },
    "calls_count": {
        series_key("GigaSearch", "common"): AxisConfig(
            maximum=50_000_000, interval=5_000_000, value_format="millions"
        ),
        series_key("GigaSearch", "alpha_common"): AxisConfig(
            maximum=10_000_000, interval=1_000_000, value_format="millions"
        ),
        series_key("GigaSearch", "alpha_b2c_sbol"): AxisConfig(
            maximum=40_000_000, interval=10_000_000, value_format="millions"
        ),
        series_key("GigaSearch", "sigma"): AxisConfig(
            maximum=3_000_000, interval=500_000, value_format="millions"
        ),
        series_key("GigaQuery", "common"): AxisConfig(
            maximum=20_000_000, interval=5_000_000, value_format="millions"
        ),
        series_key("GigaQuery", "alpha"): AxisConfig(
            maximum=20_000_000, interval=1_000_000, value_format="millions"
        ),
        series_key("GigaQuery", "sigma"): AxisConfig(
            maximum=5_000_000, interval=1_000_000, value_format="millions"
        ),
        series_key("Summarization", "common"): AxisConfig(
            maximum=20_000_000, interval=5_000_000, value_format="millions"
        ),
        series_key("Summarization", "alpha"): AxisConfig(
            maximum=15_000_000, interval=5_000_000, value_format="millions"
        ),
        series_key("Summarization", "sigma"): AxisConfig(
            maximum=10_000_000, interval=2_000_000, value_format="millions"
        ),
    },
}


def build_widget_registry() -> list[WidgetConfig]:
    monthly_period_filter = FilterConfig(
        key="period_mode",
        label="Период",
        control="period",
        default="last_12_months",
        options=[
            FilterOption(value="last_12_months", label="Последние 12 месяцев"),
            FilterOption(value="custom", label="Кастомный период"),
        ],
    )

    monthly_filters_base = [
        FilterConfig(
            key="direction",
            label="Направление",
            control="select",
            default=Direction.GIGA_SEARCH.value,
            options=DIRECTION_OPTIONS,
        ),
        FilterConfig(
            key="segment",
            label="Срез",
            control="select",
            default="common",
            depends_on="direction",
        ),
    ]
    monthly_filters = [*monthly_filters_base, monthly_period_filter]

    return [
        WidgetConfig(
            widget_id="calls_count",
            title="Вызовы LLM сервисов",
            chart_type=ChartType.LINE,
            layout_class="widget-tile-wide",
            subtitle="Главный фокусный график. Значения оси Y форматируются в миллионах и подстраиваются под сегмент.",
            filters=monthly_filters_base,
            default_state={
                "direction": Direction.GIGA_SEARCH.value,
                "segment": "common",
                "period_mode": "last_12_months",
            },
            axis_by_series=MONTHLY_AXIS["calls_count"],
        ),
        WidgetConfig(
            widget_id="source_distribution",
            title="Источники",
            chart_type=ChartType.PIE,
            layout_class="widget-tile",
            subtitle="Структура источников для выбранного сетевого сегмента.",
            filters=[
                FilterConfig(
                    key="network_segment",
                    label="Сегмент сети",
                    control="select",
                    default="alpha",
                    options=[
                        FilterOption(value="alpha", label="alpha"),
                        FilterOption(value="sigma", label="sigma"),
                    ],
                )
            ],
            default_state={"network_segment": "alpha"},
        ),
        WidgetConfig(
            widget_id="tickets_created",
            title="Тикеты",
            chart_type=ChartType.LINE,
            layout_class="widget-tile",
            subtitle="Можно смотреть текущий, предыдущий или оба спринта на одном графике.",
            filters=[
                FilterConfig(
                    key="sprint_view",
                    label="Спринт",
                    control="select",
                    default="current",
                    options=[
                        FilterOption(value="current", label="Текущий"),
                        FilterOption(value="previous", label="Предыдущий"),
                        FilterOption(value="overlay", label="Сравнить"),
                    ],
                )
            ],
            default_state={"sprint_view": "current"},
        ),
        WidgetConfig(
            widget_id="initiatives_created",
            title="Заведенные инициативы",
            chart_type=ChartType.LINE,
            layout_class="widget-tile",
            subtitle="Динамика по инициативам с зависимыми фильтрами по направлению.",
            filters=monthly_filters,
            default_state={
                "direction": Direction.GIGA_SEARCH.value,
                "segment": "common",
                "period_mode": "last_12_months",
            },
            axis_by_series=MONTHLY_AXIS["initiatives_created"],
        ),
        WidgetConfig(
            widget_id="initiatives_in_prod",
            title="Инициативы в ПРОМе",
            chart_type=ChartType.LINE,
            layout_class="widget-tile",
            subtitle="Те же фильтры, но с отдельной метрикой вывода в прод.",
            filters=monthly_filters,
            default_state={
                "direction": Direction.GIGA_SEARCH.value,
                "segment": "common",
                "period_mode": "last_12_months",
            },
            axis_by_series=MONTHLY_AXIS["initiatives_in_prod"],
        ),
    ]


def segment_options_by_widget() -> dict[str, dict[str, list[dict[str, str]]]]:
    return {
        widget_id: {
            direction: [option.model_dump(mode="json") for option in options]
            for direction, options in direction_map.items()
        }
        for widget_id, direction_map in MONTHLY_SEGMENTS.items()
    }
