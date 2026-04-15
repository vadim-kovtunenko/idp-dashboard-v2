from __future__ import annotations

from enum import StrEnum


class MonthlyMetricId(StrEnum):
    INITIATIVES_CREATED = "initiatives_created"
    INITIATIVES_IN_PROD = "initiatives_in_prod"
    CALLS_COUNT = "calls_count"


class Direction(StrEnum):
    GIGA_SEARCH = "GigaSearch"
    GIGA_QUERY = "GigaQuery"
    SUMMARIZATION = "Summarization"


class NetworkSegment(StrEnum):
    ALPHA = "alpha"
    SIGMA = "sigma"


class Sprint(StrEnum):
    CURRENT = "current"
    PREVIOUS = "previous"


class ChartType(StrEnum):
    LINE = "line"
    PIE = "pie"
