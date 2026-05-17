import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import Chart from "chart.js/auto";

@customElement("rotating-chart-card")
export class RotatingChartCard extends LitElement {
  @property({ type: Object }) hass?: any;
  @property({ type: Object }) _config: any = {};

  @state() private powerChartData: { labels: string[]; power: number[] } = { labels: [], power: [] };
  @state() private efficiencyChartData: { labels: string[]; efficiency: number[] } = { labels: [], efficiency: [] };
  @state() private chartMarqueeIndex: number = 0;
  private chartMarqueeInterval: number | null = null;
  private powerChart: Chart | null = null;
  private efficiencyChart: Chart | null = null;


  /**
   * Advanced Home Assistant config UI schema (for Lovelace UI editor)
   * Matches bitcoin-miner-card pattern
   */
  static getConfigForm() {
    return {
      schema: [
        { name: "fleet_power_entity", selector: { entity: {} } },
        { name: "efficiency_chart_entity", selector: { entity: {} } },
        {
          name: "rotation_duration",
          selector: {
            select: {
              options: [
                { value: 5, label: "5 seconds" },
                { value: 10, label: "10 seconds" },
                { value: 15, label: "15 seconds" },
                { value: 30, label: "30 seconds" }
              ]
            }
          }
        },
        { name: "background_color", selector: { color: {} } },
        { name: "xaxis_label_color", selector: { color: {} } },
        { name: "yaxis_label_color", selector: { color: {} } },
        { name: "xaxis_tick_amount", selector: { number: { min: 2, max: 24, step: 1, mode: "box" } } },
        { name: "yaxis_tick_amount", selector: { number: { min: 2, max: 24, step: 1, mode: "box" } } },
        { name: "chart_color", selector: { color: {} } },
        { name: "show_title", selector: { boolean: {} } },
        { name: "show_legend", selector: { boolean: {} } }
      ],
      computeLabel: (schema: any) => {
        switch (schema.name) {
          case "fleet_power_entity":
            return "Fleet Power Entity";
          case "efficiency_chart_entity":
            return "Efficiency Chart Entity";
          case "rotation_duration":
            return "Rotation Duration";
          case "background_color":
            return "Background Color";
          case "xaxis_label_color":
            return "X-Axis Label Color";
          case "yaxis_label_color":
            return "Y-Axis Label Color";
          case "xaxis_tick_amount":
            return "Tick Amount X-Axis";
          case "yaxis_tick_amount":
            return "Tick Amount Y-Axis";
          case "chart_color":
            return "Chart Colour";
          case "show_title":
            return "Show Title";
          case "show_legend":
            return "Show Legend";
          default:
            return undefined;
        }
      },
      computeHelper: (schema: any) => {
        switch (schema.name) {
          case "fleet_power_entity":
            return "Entity used for the power chart.";
          case "efficiency_chart_entity":
            return "Entity used for the efficiency chart.";
          case "rotation_duration":
            return "How long each chart is shown before rotating.";
          case "background_color":
            return "Background color for the chart area.";
          case "xaxis_label_color":
            return "Color for X-axis labels.";
          case "yaxis_label_color":
            return "Color for Y-axis labels.";
          case "xaxis_tick_amount":
            return "Number of ticks on the X-axis.";
          case "yaxis_tick_amount":
            return "Number of ticks on the Y-axis.";
          case "chart_color":
            return "Line color for the chart.";
          case "show_title":
            return "Show chart title above the chart.";
          case "show_legend":
            return "Show chart legend.";
          default:
            return undefined;
        }
      }
    };
  }

  static getStubConfig() {
    return {
      fleet_power_entity: "sensor.fleet_power",
      efficiency_chart_entity: "sensor.fleet_energy_efficiency",
      rotation_duration: 5
    };
  }

  setConfig(config: any) {
    this._config = config;
  }

  connectedCallback() {
    super.connectedCallback();
    this.startChartMarquee();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.chartMarqueeInterval !== null) {
      clearInterval(this.chartMarqueeInterval);
      this.chartMarqueeInterval = null;
    }
  }

  updated(changedProps: PropertyValues) {
    if (changedProps.has("hass")) {
      this.fetchAndPopulatePowerHistory();
      this.fetchAndPopulateEfficiencyHistory();
    }
  }

  private startChartMarquee() {
    if (this.chartMarqueeInterval !== null) return;
    const duration = Number(this._config?.rotation_duration) || 5;
    this.chartMarqueeInterval = window.setInterval(() => {
      this.chartMarqueeIndex = (this.chartMarqueeIndex + 1) % 2;
      this.requestUpdate();
    }, duration * 1000);
  }

  private async fetchAndPopulatePowerHistory() {
    const entity = this._config?.fleet_power_entity;
    if (!this.hass || !entity || !this.hass.connection) return;
    const end = new Date();
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    try {
      const historyResult = await this.hass.connection.sendMessagePromise({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        entity_ids: [entity],
        minimal_response: true,
        no_attributes: true
      });
      const points = this.extractHistoryPoints(historyResult, entity);
      this.powerChartData = { labels: [], power: [] };
      for (const point of points) {
        const ts = new Date((point.lu ?? point.last_updated_ts) * 1000);
        const label = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const value = parseFloat(point.s ?? point.state ?? "NaN");
        if (!Number.isNaN(value)) {
          (this.powerChartData.labels as string[]).push(label);
          (this.powerChartData.power as number[]).push(value);
        }
      }
      if (this.powerChartData.labels.length === 0) {
        (this.powerChartData.labels as string[]).push("Now");
        (this.powerChartData.power as number[]).push(parseFloat(this._getEntityState(entity)));
      }
      this.renderPowerChart();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to fetch power history", e);
    }
  }

  private async fetchAndPopulateEfficiencyHistory() {
    const entity = this._config?.efficiency_chart_entity;
    if (!this.hass || !entity || !this.hass.connection) return;
    const end = new Date();
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    try {
      const historyResult = await this.hass.connection.sendMessagePromise({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        entity_ids: [entity],
        minimal_response: true,
        no_attributes: true
      });
      const points = this.extractHistoryPoints(historyResult, entity);
      this.efficiencyChartData = { labels: [], efficiency: [] };
      for (const point of points) {
        const ts = new Date((point.lu ?? point.last_updated_ts) * 1000);
        const label = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const value = parseFloat(point.s ?? point.state ?? "NaN");
        if (!Number.isNaN(value)) {
          (this.efficiencyChartData.labels as string[]).push(label);
          (this.efficiencyChartData.efficiency as number[]).push(value);
        }
      }
      if (this.efficiencyChartData.labels.length === 0) {
        (this.efficiencyChartData.labels as string[]).push("Now");
        (this.efficiencyChartData.efficiency as number[]).push(parseFloat(this._getEntityState(entity)));
      }
      this.renderEfficiencyChart();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to fetch efficiency history", e);
    }
  }

  private extractHistoryPoints(historyResult: any, entityId: string) {
    if (historyResult && typeof historyResult === "object" && !Array.isArray(historyResult)) {
      return historyResult[entityId] ?? [];
    }
    if (Array.isArray(historyResult)) {
      const entities = historyResult as Array<Array<any>>;
      return entities.find((series) => series[0]?.entity_id === entityId) ?? [];
    }
    return [];
  }

  private _getEntityState(entity: string) {
    return this.hass?.states?.[entity]?.state ?? "0";
  }

  private renderPowerChart() {
    const canvas = this.renderRoot?.querySelector("#power-chart") as HTMLCanvasElement | null;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    // Read config options with fallbacks
    const cfg = this._config || {};
    const chartColor = cfg.chart_color || "#ff2bd6";
    const bgColor = cfg.background_color || "rgba(255,43,214,0.12)";
    const xLabelColor = cfg.xaxis_label_color || chartColor;
    const yLabelColor = cfg.yaxis_label_color || "#ffffff";
    const xTicks = Number(cfg.xaxis_tick_amount) || 6;
    const yTicks = Number(cfg.yaxis_tick_amount) || 3;
    const showTitle = cfg.show_title !== undefined ? cfg.show_title : true;
    const showLegend = cfg.show_legend !== undefined ? cfg.show_legend : false;
    const chartConfig = {
      type: "line" as const,
      data: {
        labels: this.powerChartData.labels,
        datasets: [{
          label: "Power",
          data: this.powerChartData.power,
          borderColor: chartColor,
          backgroundColor: bgColor,
          tension: 0.28,
          pointRadius: 0,
          borderWidth: 2,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: showTitle,
            text: "Power",
            color: yLabelColor,
            font: { size: 12 },
            padding: { top: 2, bottom: 2 }
          },
          legend: { display: showLegend }
        },
        scales: {
          x: {
            ticks: { color: xLabelColor, font: { size: 10 }, maxTicksLimit: xTicks },
            grid: { color: "rgba(159,251,255,0.12)" }
          },
          y: {
            title: { display: true, text: "W", color: yLabelColor, font: { size: 10 } },
            ticks: { color: yLabelColor, font: { size: 10 }, maxTicksLimit: yTicks },
            grid: { color: "rgba(21,255,0,0.12)" }
          }
        }
      }
    };
    if (!this.powerChart) {
      this.powerChart = new Chart(context, chartConfig);
      return;
    }
    this.powerChart.data.labels = this.powerChartData.labels;
    this.powerChart.data.datasets[0].data = this.powerChartData.power;
    this.powerChart.update("none");
  }

  private renderEfficiencyChart() {
    const canvas = this.renderRoot?.querySelector("#efficiency-chart") as HTMLCanvasElement | null;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    // Read config options with fallbacks
    const cfg = this._config || {};
    const chartColor = cfg.chart_color || "#00f5ff";
    const bgColor = cfg.background_color || "rgba(0,245,255,0.12)";
    const xLabelColor = cfg.xaxis_label_color || chartColor;
    const yLabelColor = cfg.yaxis_label_color || "#ffffff";
    const xTicks = Number(cfg.xaxis_tick_amount) || 6;
    const yTicks = Number(cfg.yaxis_tick_amount) || 3;
    const showTitle = cfg.show_title !== undefined ? cfg.show_title : true;
    const showLegend = cfg.show_legend !== undefined ? cfg.show_legend : false;
    const chartConfig = {
      type: "line" as const,
      data: {
        labels: this.efficiencyChartData.labels,
        datasets: [{
          label: "Efficiency",
          data: this.efficiencyChartData.efficiency,
          borderColor: chartColor,
          backgroundColor: bgColor,
          tension: 0.28,
          pointRadius: 0,
          borderWidth: 2,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: showTitle,
            text: "Efficiency",
            color: yLabelColor,
            font: { size: 12 },
            padding: { top: 2, bottom: 2 }
          },
          legend: { display: showLegend }
        },
        scales: {
          x: {
            ticks: { color: xLabelColor, font: { size: 10 }, maxTicksLimit: xTicks },
            grid: { color: "rgba(159,251,255,0.12)" }
          },
          y: {
            title: { display: true, text: "J/TH", color: yLabelColor, font: { size: 10 } },
            ticks: { color: yLabelColor, font: { size: 10 }, maxTicksLimit: yTicks },
            grid: { color: "rgba(21,255,0,0.12)" }
          }
        }
      }
    };
    if (!this.efficiencyChart) {
      this.efficiencyChart = new Chart(context, chartConfig);
      return;
    }
    this.efficiencyChart.data.labels = this.efficiencyChartData.labels;
    this.efficiencyChart.data.datasets[0].data = this.efficiencyChartData.efficiency;
    this.efficiencyChart.update("none");
  }

  render() {
    return html`
      <ha-card>
        <div class="marquee-container">
          <div class="chart-stack ${this.chartMarqueeIndex === 0 ? 'active' : 'inactive'} ${this.chartMarqueeIndex === 0 ? 'slide-down' : ''}">
            <canvas id="efficiency-chart" aria-label="Efficiency history chart"></canvas>
          </div>
          <div class="chart-stack ${this.chartMarqueeIndex === 1 ? 'active' : 'inactive'} ${this.chartMarqueeIndex === 1 ? 'slide-down' : ''}">
            <canvas id="power-chart" aria-label="Power history chart"></canvas>
          </div>
        </div>
        <div class="hud-group">
          <div class="sensor-chip hud-power">Power: <span class="chip-value">${this._getEntityState(this._config?.fleet_power_entity)}</span></div>
          <div class="sensor-chip hud-efficiency">Efficiency: <span class="chip-value">${this._getEntityState(this._config?.efficiency_chart_entity)}</span></div>
        </div>
      </ha-card>
    `;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--cmf-font-stack, Arial, sans-serif);
      width: 100%;
      box-sizing: border-box;
    }
    ha-card {
      width: 100%;
      box-sizing: border-box;
      padding: 0;
    }
    .marquee-container {
      position: relative;
      width: 100%;
      aspect-ratio: 2.2 / 1;
      min-height: 180px;
      max-height: 320px;
      margin-bottom: 16px;
      overflow: hidden;
      display: flex;
      align-items: stretch;
      justify-content: stretch;
    }
    .chart-stack {
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0;
      pointer-events: none;
      z-index: 1;
      transition: opacity 0.5s;
      transform: translateY(-40px);
      display: flex;
      align-items: stretch;
      justify-content: stretch;
    }
    .chart-stack.active {
      opacity: 1;
      pointer-events: auto;
      z-index: 2;
    }
    .chart-stack.slide-down {
      animation: slideDown 0.5s cubic-bezier(0.4, 0.8, 0.2, 1);
      transform: translateY(0);
    }
    .chart-stack canvas {
      width: 100% !important;
      height: 100% !important;
      display: block;
      aspect-ratio: 2.2 / 1;
      max-height: 320px;
      min-height: 180px;
    }
    @keyframes slideDown {
      0% {
        opacity: 0;
        transform: translateY(-40px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .hud-group {
      display: flex;
      gap: 16px;
      justify-content: flex-start;
      align-items: center;
      padding: 8px 0 0 8px;
    }
    .sensor-chip {
      background: #222;
      color: #fff;
      border-radius: 8px;
      padding: 4px 12px;
      font-size: 1em;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .chip-value {
      font-weight: bold;
      margin-left: 4px;
    }
  `;
}

// Register for Home Assistant
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "rotating-chart-card",
  name: "Rotating Chart Card",
  description: "Custom card for rotating Power and Efficiency charts with HUD",
  preview: true,
  documentationURL: "https://github.com/daylehouse/rotating-chart-card"
});
