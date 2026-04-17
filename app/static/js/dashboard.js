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

const integerFormatter = new Intl.NumberFormat("ru-RU");

function findWidgetConfig(widgetId) {
  return dashboardPayload.widget_configs.find((item) => item.widget_id === widgetId);
}

function formatMonth(month) {
  return monthFormatter
    .format(new Date(`${month}-01T12:00:00`))
    .replace(/\./g, "")
    .replace(" г", "");
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

function formatOverviewValue(widgetId, value) {
  return widgetId === "calls_count" ? formatMillions(value) : integerFormatter.format(value);
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
    this.overviewCardNode = document.querySelector(`[data-overview-widget="${this.widgetId}"]`);
    this.widgetTrendNode = element.querySelector("[data-widget-trend-badge]");
    this.chartNode = element.querySelector("[data-chart]");
    this.emptyStateNode = element.querySelector("[data-empty-state]");
    this.monthRangeNode = element.querySelector("[data-month-range]");
    this.periodPresetButtons = Array.from(element.querySelectorAll("[data-period-preset]"));
    this.customSelectNodes = Object.fromEntries(
      Array.from(element.querySelectorAll("[data-custom-select-key]")).map((node) => [
        node.dataset.customSelectKey,
        {
          root: node,
          trigger: node.querySelector("[data-custom-select-trigger]"),
          label: node.querySelector("[data-custom-select-label]"),
          menu: node.querySelector("[data-custom-select-menu]"),
        },
      ]),
    );
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
    this.handleDocumentPointerDown = this.onDocumentPointerDown.bind(this);
    this.handleDocumentKeydown = this.onDocumentKeydown.bind(this);
  }

  init() {
    if (this.state.period_mode) {
      this.state.date_from = this.meta.default_month_range.start;
      this.state.date_to = this.meta.default_month_range.end;
    }

    this.syncDependentFilters();
    this.bindEvents();
    this.syncDomState();

    if (Object.keys(this.customSelectNodes).length) {
      document.addEventListener("pointerdown", this.handleDocumentPointerDown);
      document.addEventListener("keydown", this.handleDocumentKeydown);
    }

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

    this.periodPresetButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.updateFilter("period_mode", button.dataset.periodPreset);
      });
    });

    Object.entries(this.customSelectNodes).forEach(([key, customSelect]) => {
      customSelect.trigger?.addEventListener("click", (event) => {
        event.preventDefault();
        this.toggleCustomSelect(key);
      });

      customSelect.menu?.addEventListener("click", (event) => {
        const optionButton = event.target.closest("[data-option-value]");
        if (!optionButton) {
          return;
        }

        this.updateFilter(key, optionButton.dataset.optionValue);
        this.closeCustomSelect(key);
        customSelect.trigger?.focus();
      });

      customSelect.root?.addEventListener("keydown", (event) => {
        this.handleCustomSelectKeydown(key, event);
      });
    });
  }

  onDocumentPointerDown(event) {
    const clickedInsideCustomSelect = Object.values(this.customSelectNodes).some(({ root }) =>
      root.contains(event.target),
    );
    if (!clickedInsideCustomSelect) {
      this.closeAllCustomSelects();
    }
  }

  onDocumentKeydown(event) {
    if (event.key === "Escape") {
      this.closeAllCustomSelects();
    }
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
    this.widget.filters
      .filter((filter) => ["select", "toggle", "period"].includes(filter.control))
      .forEach((filter) => {
        const node = this.selectNodes[filter.key];
        if (!node) {
          return;
        }

        const options = this.resolveOptions(filter);
        node.innerHTML = options
          .map(
            (option) =>
              `<option value="${option.value}" ${
                this.state[filter.key] === option.value ? "selected" : ""
              }>${option.label}</option>`,
          )
          .join("");

        this.syncCustomSelect(filter.key, options);
      });

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

    if (this.monthRangeNode) {
      this.monthRangeNode.classList.toggle("is-hidden", this.state.period_mode !== "custom");
    }

    this.periodPresetButtons.forEach((button) => {
      const isActive = button.dataset.periodPreset === this.state.period_mode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  syncCustomSelect(key, options) {
    const customSelect = this.customSelectNodes[key];
    if (!customSelect) {
      return;
    }

    const selectedOption = options.find((option) => option.value === this.state[key]) ?? options[0] ?? null;
    customSelect.label.textContent = selectedOption?.label ?? "Нет опций";
    customSelect.trigger.disabled = options.length === 0;
    customSelect.trigger.setAttribute("aria-expanded", "false");
    customSelect.root.classList.remove("is-open");

    customSelect.menu.innerHTML = options.length
      ? options
          .map((option) => {
            const isSelected = option.value === selectedOption?.value;
            return `
              <button
                type="button"
                class="custom-select-option ${isSelected ? "is-selected" : ""}"
                role="option"
                aria-selected="${isSelected}"
                data-option-value="${option.value}"
                tabindex="-1"
              >
                <span>${option.label}</span>
              </button>
            `;
          })
          .join("")
      : '<div class="custom-select-empty">Нет доступных значений</div>';

    this.closeCustomSelect(key);
  }

  closeCustomSelect(key) {
    const customSelect = this.customSelectNodes[key];
    if (!customSelect) {
      return;
    }

    customSelect.root.classList.remove("is-open");
    customSelect.menu.classList.add("is-hidden");
    customSelect.trigger.setAttribute("aria-expanded", "false");
  }

  closeAllCustomSelects(exceptKey = null) {
    Object.keys(this.customSelectNodes).forEach((key) => {
      if (key !== exceptKey) {
        this.closeCustomSelect(key);
      }
    });
  }

  openCustomSelect(key) {
    const customSelect = this.customSelectNodes[key];
    if (!customSelect || customSelect.trigger.disabled) {
      return;
    }

    this.closeAllCustomSelects(key);
    customSelect.root.classList.add("is-open");
    customSelect.menu.classList.remove("is-hidden");
    customSelect.trigger.setAttribute("aria-expanded", "true");
  }

  toggleCustomSelect(key) {
    const customSelect = this.customSelectNodes[key];
    if (!customSelect) {
      return;
    }

    if (customSelect.root.classList.contains("is-open")) {
      this.closeCustomSelect(key);
      return;
    }

    this.openCustomSelect(key);
  }

  handleCustomSelectKeydown(key, event) {
    const customSelect = this.customSelectNodes[key];
    if (!customSelect) {
      return;
    }

    const optionButtons = Array.from(customSelect.menu.querySelectorAll("[data-option-value]"));
    const selectedButton = customSelect.menu.querySelector(".is-selected");
    const activeIndex = optionButtons.findIndex((button) => button === document.activeElement);

    if (event.key === "Escape") {
      this.closeCustomSelect(key);
      customSelect.trigger.focus();
      return;
    }

    if (
      event.target === customSelect.trigger &&
      (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      this.openCustomSelect(key);
      (selectedButton ?? optionButtons[0])?.focus();
      return;
    }

    if (!customSelect.root.classList.contains("is-open")) {
      return;
    }

    if (event.key === "Tab") {
      this.closeCustomSelect(key);
      return;
    }

    if (!optionButtons.length) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const fallbackIndex = optionButtons.findIndex((button) => button === selectedButton);
      const startIndex = activeIndex >= 0 ? activeIndex : Math.max(fallbackIndex, 0);
      const nextIndex = (startIndex + direction + optionButtons.length) % optionButtons.length;
      optionButtons[nextIndex]?.focus();
    }

    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-option-value]")) {
      event.preventDefault();
      event.target.click();
    }
  }

  updateFilter(key, value) {
    this.state[key] = value;

    if (key === "direction") {
      this.syncDependentFilters();
    }

    if (key === "date_from" && !this.state.date_to) {
      this.state.date_to = value;
    }

    if (key === "date_to" && !this.state.date_from) {
      this.state.date_from = value;
    }

    this.closeAllCustomSelects();
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

    if (this.state.period_mode === "last_3_months") {
      return months.slice(-3);
    }

    if (this.state.period_mode === "last_6_months") {
      return months.slice(-6);
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

  buildChangeModel(currentValue, previousValue) {
    const delta = currentValue - previousValue;
    const percentChange =
      previousValue === 0 ? (currentValue === 0 ? 0 : 100) : Math.abs((delta / previousValue) * 100);
    const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";

    return {
      currentValue,
      previousValue,
      direction,
      arrow,
      percentLabel: `${percentChange.toFixed(1)}%`,
    };
  }

  monthlyTrendModel() {
    const points = this.filteredMonthlySeries();
    const latest = points[points.length - 1];
    if (!latest) {
      return null;
    }

    const previous = points[points.length - 2] ?? latest;
    return {
      latestValue: latest.value,
      latestMonth: latest.month,
      previousMonth: previous.month,
      ...this.buildChangeModel(latest.value, previous.value),
    };
  }

  ticketsTrendModel() {
    const model = this.ticketChartModel();
    if (!model.series.length) {
      return null;
    }

    if (this.state.sprint_view === "overlay" && model.series.length >= 2) {
      const currentValue = model.series[0].data[model.series[0].data.length - 1] ?? 0;
      const previousValue = model.series[1].data[model.series[1].data.length - 1] ?? currentValue;
      return this.buildChangeModel(currentValue, previousValue);
    }

    const activeSeries = model.series[0].data;
    const currentValue = activeSeries[activeSeries.length - 1];
    if (currentValue === undefined) {
      return null;
    }

    const previousValue = activeSeries[activeSeries.length - 2] ?? currentValue;
    return this.buildChangeModel(currentValue, previousValue);
  }

  widgetTrendModel() {
    if (["initiatives_created", "initiatives_in_prod", "calls_count"].includes(this.widgetId)) {
      return this.monthlyTrendModel();
    }
    if (this.widgetId === "tickets_created") {
      return this.ticketsTrendModel();
    }
    return null;
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
          smooth: false,
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
          smooth: false,
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

  syncOverviewCard() {
    const overviewMetricIds = ["initiatives_created", "initiatives_in_prod", "calls_count"];
    if (!this.overviewCardNode || !overviewMetricIds.includes(this.widgetId)) {
      return;
    }

    const trendModel = this.monthlyTrendModel();
    if (!trendModel) {
      return;
    }
    const changeBadge = this.overviewCardNode.querySelector("[data-overview-change-badge]");

    this.overviewCardNode.querySelector("[data-overview-value]").textContent = formatOverviewValue(
      this.widgetId,
      trendModel.latestValue,
    );
    this.overviewCardNode.querySelector("[data-overview-change]").textContent = trendModel.percentLabel;
    this.overviewCardNode.querySelector("[data-overview-arrow]").textContent = trendModel.arrow;

    changeBadge.classList.remove(
      "overview-card-change-up",
      "overview-card-change-down",
      "overview-card-change-flat",
    );
    changeBadge.classList.add(`overview-card-change-${trendModel.direction}`);
  }

  syncWidgetTrendBadge() {
    if (!this.widgetTrendNode) {
      return;
    }

    const trendModel = this.widgetTrendModel();
    if (!trendModel) {
      this.widgetTrendNode.classList.add("is-hidden");
      return;
    }

    this.widgetTrendNode.querySelector("[data-widget-trend-value]").textContent = trendModel.percentLabel;
    this.widgetTrendNode.querySelector("[data-widget-trend-arrow]").textContent = trendModel.arrow;

    this.widgetTrendNode.classList.remove(
      "is-hidden",
      "widget-trend-badge-up",
      "widget-trend-badge-down",
      "widget-trend-badge-flat",
    );
    this.widgetTrendNode.classList.add(`widget-trend-badge-${trendModel.direction}`);
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

    this.syncOverviewCard();
    this.syncWidgetTrendBadge();

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
