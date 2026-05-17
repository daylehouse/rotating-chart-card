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
        { name: "rotation_duration", selector: { number: { min: 1, max: 60, unit: "s", mode: "box" } } }
      ],
      computeLabel: (schema: any) => {
        switch (schema.name) {
          case "fleet_power_entity":
            return "Fleet Power Entity";
          case "efficiency_chart_entity":
            return "Efficiency Chart Entity";
          case "rotation_duration":
            return "Rotation Duration (seconds)";
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
    const chartConfig = {
      type: "line" as const,
      data: {
        labels: this.powerChartData.labels,
        datasets: [{
          label: "Power",
          data: this.powerChartData.power,
          borderColor: "#ff2bd6",
          backgroundColor: "rgba(255,43,214,0.12)",
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
            display: true,
            text: "Power",
            color: "#ffffff",
            font: { size: 12 },
            padding: { top: 2, bottom: 2 }
          },
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: "#ff2bd6", font: { size: 10 } },
            grid: { color: "rgba(159,251,255,0.12)" }
          },
          y: {
            title: { display: true, text: "W", color: "#ffffff", font: { size: 10 } },
            ticks: { color: "#ff2bd6", font: { size: 10 }, maxTicksLimit: 3 },
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
    const chartConfig = {
      type: "line" as const,
      data: {
        labels: this.efficiencyChartData.labels,
        datasets: [{
          label: "Efficiency",
          data: this.efficiencyChartData.efficiency,
          borderColor: "#00f5ff",
          backgroundColor: "rgba(0,245,255,0.12)",
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
            display: true,
            text: "Efficiency",
            color: "#ffffff",
            font: { size: 12 },
            padding: { top: 2, bottom: 2 }
          },
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: "#00f5ff", font: { size: 10 } },
            grid: { color: "rgba(159,251,255,0.12)" }
          },
          y: {
            title: { display: true, text: "J/TH", color: "#ffffff", font: { size: 10 } },
            ticks: { color: "#00f5ff", font: { size: 10 }, maxTicksLimit: 3 },
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
          <div class="chart-stack" style="opacity: ${this.chartMarqueeIndex === 0 ? 1 : 0}; pointer-events: ${this.chartMarqueeIndex === 0 ? 'auto' : 'none'};">
            <canvas id="efficiency-chart" aria-label="Efficiency history chart"></canvas>
          </div>
          <div class="chart-stack" style="opacity: ${this.chartMarqueeIndex === 1 ? 1 : 0}; pointer-events: ${this.chartMarqueeIndex === 1 ? 'auto' : 'none'};">
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
    }
    .marquee-container {
      position: relative;
      width: 100%;
      height: 200px;
      margin-bottom: 16px;
    }
    .chart-stack {
      position: absolute;
      width: 100%;
      height: 100%;
      transition: opacity 0.7s;
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
