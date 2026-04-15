from __future__ import annotations

import json
from pathlib import Path

from app.domain.models import (
    DashboardDataset,
    MonthlyMetricRecord,
    MonthlyMetricsDataset,
    SourceDistributionDataset,
    TicketRecord,
    TicketsDataset,
)
from app.settings import DATA_DIR


class DashboardDataLoader:
    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = data_dir or DATA_DIR

    def load(self) -> DashboardDataset:
        monthly_metrics = self._load_monthly_metrics()
        source_distribution = self._load_source_distribution()
        tickets = self._load_tickets()
        available_months = sorted({record.month for record in monthly_metrics})

        return DashboardDataset(
            monthly_metrics=monthly_metrics,
            source_distribution=source_distribution,
            tickets=tickets,
            available_months=available_months,
        )

    def _load_json(self, file_name: str) -> str:
        file_path = self.data_dir / file_name
        return file_path.read_text(encoding="utf-8")

    def _load_monthly_metrics(self) -> list[MonthlyMetricRecord]:
        dataset = MonthlyMetricsDataset.model_validate_json(self._load_json("monthly_metrics.json"))
        records: list[MonthlyMetricRecord] = []
        for series in dataset.series:
            for month, value in zip(dataset.months, series.values, strict=True):
                records.append(
                    MonthlyMetricRecord(
                        metric_id=series.metric_id,
                        direction=series.direction,
                        segment=series.segment,
                        month=month,
                        value=value,
                    )
                )
        return records

    def _load_source_distribution(self):
        dataset = SourceDistributionDataset.model_validate_json(
            self._load_json("source_distribution.json")
        )
        return dataset.records

    def _load_tickets(self) -> list[TicketRecord]:
        dataset = TicketsDataset.model_validate_json(self._load_json("tickets.json"))
        records: list[TicketRecord] = []
        for series in dataset.series:
            for day_index, weekday_label, value in zip(
                dataset.days, dataset.weekday_labels, series.values, strict=True
            ):
                records.append(
                    TicketRecord(
                        sprint=series.sprint,
                        day_index=day_index,
                        weekday_label=weekday_label,
                        value=value,
                    )
                )
        return records

    def export_pretty_json(self) -> str:
        return json.dumps(self.load().model_dump(mode="json"), ensure_ascii=False, indent=2)
