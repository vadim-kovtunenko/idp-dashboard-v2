const dashboardPayloadElement = document.getElementById("dashboard-payload");
const dashboardPayload = dashboardPayloadElement
  ? JSON.parse(dashboardPayloadElement.textContent)
  : { widget_configs: [], data: {}, meta: { available_months: [], default_month_range: {} } };

let widgetInstances = [];
let widgetsInitialized = false;

const widgetPalette = {
  initiatives_created: ["#121317", "#9edceb"],
  initiatives_in_prod: ["#121317", "#9edceb"],
  calls_count: ["#121317", "#9edceb"],
  source_distribution: ["#121317", "#9edceb", "#d9f4fb", "#d8dde3", "#7aa6b8", "#c7ced6"],
  tickets_created: ["#121317", "#9edceb"],
};

const chartTheme = {
  muted: "#747b86",
  line: "rgba(18, 19, 23, 0.1)",
  paper: "#fffdf8",
};

const monthFormatter = new Intl.DateTimeFormat("ru-RU", {
  month: "short",
  year: "2-digit",
});

function findWidgetConfig(widgetId) {
  return dashboardPayload.widget_configs.find((item) => item.widget_id === widgetId);
}

function formatMonth(month) {
  return monthFormatter.format(new Date(`${month}-01T12:00:00`)).replace(".", "");
}

function formatMillions(value) {
  if (value === 0) {
    return "0";
  }
  if (value < 1_000_000) {
    const thousands = value / 1_000;
    return Number.isInteger(thousands) ? `${thousands}k` : `${thousands.toFixed(1)}k`;
  }

  const millions = value / 1_000_000;
  return Number.isInteger(millions) ? `${millions}M` : `${millions.toFixed(1)}M`;
}

function niceUpperBound(maxValue) {
  if (maxValue <= 10) {
    return 10;
  }
  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  return Math.ceil((maxValue * 1.15) / magnitude) * magnitude;
}

class DashboardWidget {
  constructor(element) {
    this.element = element;
    this.widgetId = element.dataset.widgetId;
    this.widget = findWidgetConfig(this.widgetId);
    this.meta = dashboardPayload.meta;
    this.state = { ...this.widget.default_state };
    this.chart = null;
    this.resizeObserver = null;
    this.summaryNode = element.querySelector("[data-summary-value]");
    this.chartNode = element.querySelector("[data-chart]");
    this.emptyStateNode = element.querySelector("[data-empty-state]");
    this.monthRangeNode = element.querySelector("[data-month-range]");
    this.selectNodes = Object.fromEntries(
      Array.from(element.querySelectorAll("select[data-filter-key]")).map((node) => [
        node.dataset.filterKey,
        node,
      ]),
    );
    this.monthInputs = Object.fromEntries(
      Array.from(element.querySelectorAll("input[data-filter-key]")).map((node) => [
        node.dataset.filterKey,
        node,
      ]),
    );
  }

  init() {
    if (this.state.period_mode) {
      this.state.date_from = this.meta.default_month_range.start;
      this.state.date_to = this.meta.default_month_range.end;
    }

    this.syncDependentFilters();
    this.bindEvents();
    this.syncDomState();

    if (window.echarts) {
      this.chart = window.echarts.init(this.chartNode);
      this.resizeObserver = new ResizeObserver(() => {
        this.chart?.resize();
      });
      this.resizeObserver.observe(this.element);
    } else {
      this.showEmptyState("Графическая библиотека не загрузилась, но фильтры уже доступны.");
    }

    this.render();
  }

  bindEvents() {
    Object.entries(this.selectNodes).forEach(([key, node]) => {
      node.addEventListener("change", (event) => {
        this.updateFilter(key, event.target.value);
      });
    });

    Object.entries(this.monthInputs).forEach(([key, node]) => {
      node.addEventListener("change", (event) => {
        this.updateFilter(key, event.target.value);
      });
    });

    this.element.querySelectorAll("button[data-filter-key]").forEach((button) => {
      button.addEventListener("click", () => {
        this.updateFilter(button.dataset.filterKey, button.dataset.filterValue);
      });
    });
  }

  resolveOptions(filter) {
    if (!filter.depends_on) {
      return filter.options ?? [];
    }

    const parentValue = this.state[filter.depends_on];
    return filter.options_by_parent[parentValue] ?? [];
  }

  syncDependentFilters() {
    const segmentFilter = this.widget.filters.find((filter) => filter.key === "segment");
    if (!segmentFilter) {
      return;
    }

    const options = this.resolveOptions(segmentFilter);
    if (!options.some((option) => option.value === this.state.segment)) {
      this.state.segment = options[0]?.value ?? "";
    }
  }

  syncDomState() {
    const segmentFilter = this.widget.filters.find((filter) => filter.key === "segment");
    if (segmentFilter && this.selectNodes.segment) {
      const options = this.resolveOptions(segmentFilter);
      this.selectNodes.segment.innerHTML = options
        .map(
          (option) =>
            `<option value="${option.value}" ${
              option.value === this.state.segment ? "selected" : ""
            }>${option.label}</option>`,
        )
        .join("");
    }

    Object.entries(this.selectNodes).forEach(([key, node]) => {
      if (key in this.state) {
        node.value = this.state[key];
      }
    });

    Object.entries(this.monthInputs).forEach(([key, node]) => {
      if (key in this.state) {
        node.value = this.state[key] ?? "";
      }
    });

    this.element.querySelectorAll("button[data-filter-key]").forEach((button) => {
      const isActive = this.state[button.dataset.filterKey] === button.dataset.filterValue;
      button.classList.toggle("is-active", isActive);
    });

    if (this.monthRangeNode) {
      this.monthRangeNode.classList.toggle("is-hidden", this.state.period_mode !== "custom");
    }
  }

  updateFilter(key, value) {
    this.state[key] = value;

    if (key === "direction") {
      this.syncDependentFilters();
    }

    if (key === "period_mode" && value !== "custom") {
      this.state.date_from = this.meta.default_month_range.start;
      this.state.date_to = this.meta.default_month_range.end;
    }

    if (key === "date_from" && !this.state.date_to) {
      this.state.date_to = value;
    }

    if (key === "date_to" && !this.state.date_from) {
      this.state.date_from = value;
    }

    this.syncDomState();
    this.render();
  }

  palette(index = 0) {
    return widgetPalette[this.widgetId][index] ?? widgetPalette.calls_count[0];
  }

  monthRange() {
    const months = this.meta.available_months ?? [];
    if (this.state.period_mode === "custom" && this.state.date_from && this.state.date_to) {
      const start = this.state.date_from < this.state.date_to ? this.state.date_from : this.state.date_to;
      const end = this.state.date_from < this.state.date_to ? this.state.date_to : this.state.date_from;
      const scopedMonths = months.filter((month) => month >= start && month <= end);
      if (scopedMonths.length > 0) {
        return scopedMonths;
      }
    }
    return months.slice(-12);
  }

  filteredMonthlySeries() {
    const range = this.monthRange();
    const records = (dashboardPayload.data.monthly_metrics ?? []).filter(
      (record) =>
        record.metric_id === this.widgetId &&
        record.direction === this.state.direction &&
        record.segment === this.state.segment &&
        range.includes(record.month),
    );

    const byMonth = new Map(records.map((record) => [record.month, record.value]));
    return range.map((month) => ({
      month,
      value: byMonth.get(month) ?? 0,
    }));
  }

  filteredSourceRecords() {
    return (dashboardPayload.data.source_distribution ?? []).filter(
      (record) => record.network_segment === this.state.network_segment,
    );
  }

  ticketChartModel() {
    const allRecords = dashboardPayload.data.tickets ?? [];
    const recordsBySprint = {
      current: allRecords
        .filter((record) => record.sprint === "current")
        .sort((left, right) => left.day_index - right.day_index),
      previous: allRecords
        .filter((record) => record.sprint === "previous")
        .sort((left, right) => left.day_index - right.day_index),
    };

    const labels = recordsBySprint.current.map((record) => `${record.weekday_label} ${record.day_index}`);
    const series = [];

    if (this.state.sprint_view === "overlay" || this.state.sprint_view === "current") {
      series.push({
        name: "Текущий спринт",
        data: recordsBySprint.current.map((record) => record.value),
        color: this.palette(0),
      });
    }

    if (this.state.sprint_view === "overlay" || this.state.sprint_view === "previous") {
      series.push({
        name: "Предыдущий спринт",
        data: recordsBySprint.previous.map((record) => record.value),
        color: this.palette(1),
      });
    }

    return { labels, series };
  }

  summaryValue() {
    if (this.widgetId === "source_distribution") {
      const total = this.filteredSourceRecords().reduce((sum, record) => sum + record.value, 0);
      return `${total} обращений`;
    }

    if (this.widgetId === "tickets_created") {
      const model = this.ticketChartModel();
      if (!model.series.length) {
        return "Нет данных";
      }
      if (this.state.sprint_view === "overlay") {
        const currentPeak = Math.max(...model.series[0].data);
        const previousPeak = Math.max(...model.series[1].data);
        return `Пики: ${currentPeak} vs ${previousPeak}`;
      }
      return `${Math.max(...model.series[0].data)} тикетов в пик`;
    }

    const series = this.filteredMonthlySeries();
    const latestPoint = series[series.length - 1];
    if (!latestPoint) {
      return "Нет данных";
    }

    const value = this.widgetId === "calls_count" ? formatMillions(latestPoint.value) : latestPoint.value;
    return `${formatMonth(latestPoint.month)}: ${value}`;
  }

  lineChartOption() {
    const points = this.filteredMonthlySeries();
    if (!points.length) {
      return null;
    }

    const axisKey = `${this.state.direction}__${this.state.segment}`;
    const axisConfig = this.widget.axis_by_series?.[axisKey] ?? {
      minimum: 0,
      maximum: null,
      interval: null,
      value_format: "integer",
    };

    return {
      color: [this.palette(0)],
      animationDuration: 450,
      grid: { top: 20, right: 14, bottom: 30, left: 50 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(18, 19, 23, 0.94)",
        borderWidth: 0,
        padding: 12,
        textStyle: { color: "#fff" },
        valueFormatter: (value) =>
          axisConfig.value_format === "millions" ? formatMillions(value) : `${value}`,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: points.map((point) => formatMonth(point.month)),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: chartTheme.muted, margin: 14 },
      },
      yAxis: {
        type: "value",
        min: axisConfig.minimum ?? 0,
        max: axisConfig.maximum ?? null,
        interval: axisConfig.interval ?? null,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: chartTheme.muted,
          margin: 12,
          formatter: (value) =>
            axisConfig.value_format === "millions" ? formatMillions(value) : `${value}`,
        },
        splitLine: { lineStyle: { color: chartTheme.line, type: "dashed" } },
      },
      series: [
        {
          name: this.widget.title,
          type: "line",
          smooth: true,
          symbol: "circle",
          showSymbol: false,
          symbolSize: 6,
          lineStyle: { width: 3, color: this.palette(0), cap: "round" },
          itemStyle: {
            color: this.palette(0),
            borderColor: chartTheme.paper,
            borderWidth: 2,
          },
          areaStyle: {
            color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${this.palette(1)}42` },
              { offset: 1, color: `${this.palette(1)}00` },
            ]),
          },
          data: points.map((point) => point.value),
        },
      ],
    };
  }

  pieChartOption() {
    const records = this.filteredSourceRecords();
    if (!records.length) {
      return null;
    }

    return {
      color: widgetPalette.source_distribution,
      animationDuration: 450,
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(18, 19, 23, 0.94)",
        borderWidth: 0,
        padding: 12,
        textStyle: { color: "#fff" },
        formatter: ({ name, value, percent }) => `${name}: ${value} (${percent}%)`,
      },
      legend: {
        orient: "vertical",
        right: 4,
        top: "center",
        itemGap: 14,
        icon: "circle",
        textStyle: { color: chartTheme.muted, fontSize: 12 },
      },
      series: [
        {
          type: "pie",
          radius: ["52%", "74%"],
          center: ["32%", "50%"],
          label: {
            show: false,
          },
          labelLine: { show: false },
          itemStyle: {
            borderColor: "#ffffff",
            borderWidth: 4,
          },
          data: records.map((record) => ({
            name: record.source,
            value: record.value,
          })),
        },
      ],
    };
  }

  ticketsChartOption() {
    const model = this.ticketChartModel();
    if (!model.series.length) {
      return null;
    }

    const maxValue = Math.max(...model.series.flatMap((series) => series.data));
    return {
      color: model.series.map((series) => series.color),
      animationDuration: 450,
      legend: {
        top: 0,
        right: 0,
        itemGap: 16,
        textStyle: { color: chartTheme.muted },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(18, 19, 23, 0.94)",
        borderWidth: 0,
        padding: 12,
        textStyle: { color: "#fff" },
      },
      grid: { top: 44, right: 18, bottom: 30, left: 46 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: model.labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: chartTheme.muted, rotate: 24, margin: 14 },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: niceUpperBound(maxValue),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: chartTheme.line, type: "dashed" } },
        axisLabel: { color: chartTheme.muted, margin: 12 },
      },
      series: model.series.map((series, index) => {
        const isComparisonSeries = this.state.sprint_view === "overlay" && index === 1;
        return {
          name: series.name,
          type: "line",
          smooth: true,
          showSymbol: false,
          symbolSize: 6,
          lineStyle: {
            width: 3,
            color: series.color,
            type: isComparisonSeries ? "dashed" : "solid",
          },
          itemStyle: {
            color: series.color,
            borderColor: chartTheme.paper,
            borderWidth: 2,
          },
          areaStyle:
            this.state.sprint_view === "overlay"
              ? undefined
              : {
                  color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: `${series.color}36` },
                    { offset: 1, color: `${series.color}00` },
                  ]),
                },
          data: series.data,
        };
      }),
    };
  }

  buildChartOption() {
    if (this.widgetId === "source_distribution") {
      return this.pieChartOption();
    }
    if (this.widgetId === "tickets_created") {
      return this.ticketsChartOption();
    }
    return this.lineChartOption();
  }

  showEmptyState(message) {
    this.emptyStateNode.textContent = message;
    this.emptyStateNode.classList.remove("is-hidden");
  }

  hideEmptyState() {
    this.emptyStateNode.classList.add("is-hidden");
  }

  render() {
    if (this.summaryNode) {
      this.summaryNode.textContent = this.summaryValue();
    }

    if (!this.chart) {
      return;
    }

    const option = this.buildChartOption();
    if (!option) {
      this.chart.clear();
      this.showEmptyState("Нет данных для выбранной комбинации фильтров.");
      return;
    }

    this.hideEmptyState();
    this.chart.setOption(option, true);
    this.chart.resize();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const initDashboardWidgets = () => {
    if (widgetsInitialized) {
      return;
    }

    widgetInstances = Array.from(document.querySelectorAll(".widget-card[data-widget-id]")).map(
      (element) => {
        const widget = new DashboardWidget(element);
        widget.init();
        return widget;
      },
    );
    widgetsInitialized = true;
  };

  const resizeDashboardWidgets = () => {
    widgetInstances.forEach((widget) => {
      widget.chart?.resize();
    });
  };

  const tabButtons = Array.from(document.querySelectorAll("[data-tab-target]"));
  const tabPanels = Array.from(document.querySelectorAll("[data-tab-panel]"));

  if (!tabButtons.length || !tabPanels.length) {
    initDashboardWidgets();
    return;
  }

  const validTabs = new Set(tabButtons.map((button) => button.dataset.tabTarget));

  const activateTab = (tabId, { syncHash = true } = {}) => {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.tabTarget === tabId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });

    tabPanels.forEach((panel) => {
      const isActive = panel.dataset.tabPanel === tabId;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });

    if (tabId === "dashboard") {
      initDashboardWidgets();
      window.requestAnimationFrame(() => {
        resizeDashboardWidgets();
      });
    }

    if (syncHash) {
      const nextHash = tabId === "dashboard" ? "" : `#${tabId}`;
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${nextHash}`,
      );
    }
  };

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tabTarget);
    });
  });

  window.addEventListener("hashchange", () => {
    const nextTab = window.location.hash.slice(1);
    activateTab(validTabs.has(nextTab) ? nextTab : "dashboard", { syncHash: false });
  });

  const initialTab = window.location.hash.slice(1);
  activateTab(validTabs.has(initialTab) ? initialTab : "dashboard", { syncHash: false });
});
