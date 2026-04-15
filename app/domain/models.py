from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.domain.enums import ChartType, Direction, MonthlyMetricId, NetworkSegment, Sprint


class FilterOption(BaseModel):
    value: str
    label: str


class FilterConfig(BaseModel):
    key: str
    label: str
    control: Literal["select", "period", "toggle"]
    default: str | None = None
    depends_on: str | None = None
    options: list[FilterOption] = Field(default_factory=list)
    options_by_parent: dict[str, list[FilterOption]] = Field(default_factory=dict)


class AxisConfig(BaseModel):
    minimum: int = 0
    maximum: int | None = None
    interval: int | None = None
    value_format: Literal["integer", "millions", "auto"] = "integer"


class WidgetConfig(BaseModel):
    widget_id: str
    title: str
    chart_type: ChartType
    layout_class: str
    subtitle: str
    filters: list[FilterConfig]
    default_state: dict[str, str]
    axis_by_series: dict[str, AxisConfig] = Field(default_factory=dict)


class MonthlyMetricSeries(BaseModel):
    metric_id: MonthlyMetricId
    direction: Direction
    segment: str
    values: list[int]


class MonthlyMetricsDataset(BaseModel):
    months: list[str]
    series: list[MonthlyMetricSeries]

    @model_validator(mode="after")
    def validate_points_length(self) -> "MonthlyMetricsDataset":
        month_count = len(self.months)
        for item in self.series:
            if len(item.values) != month_count:
                msg = (
                    f"Series {item.metric_id}/{item.direction}/{item.segment} has "
                    f"{len(item.values)} values, expected {month_count}."
                )
                raise ValueError(msg)
        return self


class MonthlyMetricRecord(BaseModel):
    metric_id: MonthlyMetricId
    direction: Direction
    segment: str
    month: str
    value: int


class SourceDistributionRecord(BaseModel):
    network_segment: NetworkSegment
    source: str
    value: int


class SourceDistributionDataset(BaseModel):
    records: list[SourceDistributionRecord]


class TicketSeries(BaseModel):
    sprint: Sprint
    values: list[int]


class TicketsDataset(BaseModel):
    days: list[int]
    weekday_labels: list[str]
    series: list[TicketSeries]

    @model_validator(mode="after")
    def validate_series_length(self) -> "TicketsDataset":
        day_count = len(self.days)
        if len(self.weekday_labels) != day_count:
            msg = "weekday_labels length must match days length."
            raise ValueError(msg)
        for item in self.series:
            if len(item.values) != day_count:
                msg = f"Sprint {item.sprint} has {len(item.values)} values, expected {day_count}."
                raise ValueError(msg)
        return self


class TicketRecord(BaseModel):
    sprint: Sprint
    day_index: int
    weekday_label: str
    value: int


class DashboardDataset(BaseModel):
    monthly_metrics: list[MonthlyMetricRecord]
    source_distribution: list[SourceDistributionRecord]
    tickets: list[TicketRecord]
    available_months: list[str]
