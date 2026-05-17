import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("rotating-chart-card-editor")
export class RotatingChartCardEditor extends LitElement {
  @property({ type: Object }) hass?: any;
  // Removed duplicate setConfig property
  @state() private _config: any = {};

  setConfig(config: any) {
    this._config = config;
  }

  render() {
    if (!this.hass) return html``;
    return html`
      <ha-form>
        <ha-entity-picker
          .hass=${this.hass}
          .value=${this._config.fleet_power_entity || ""}
          .configValue=${"fleet_power_entity"}
          @value-changed=${this._valueChanged}
          label="Fleet Power Entity"
        ></ha-entity-picker>
        <ha-entity-picker
          .hass=${this.hass}
          .value=${this._config.efficiency_chart_entity || ""}
          .configValue=${"efficiency_chart_entity"}
          @value-changed=${this._valueChanged}
          label="Efficiency Chart Entity"
        ></ha-entity-picker>
      </ha-form>
    `;
  }

  private _valueChanged(ev: CustomEvent) {
    const target = ev.target as any;
    const value = ev.detail.value;
    if (this._config[target.configValue] === value) return;
    this._config = {
      ...this._config,
      [target.configValue]: value,
    };
    this.setConfig?.(this._config);
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config } }));
  }
}

// Export for Home Assistant to find
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "rotating-chart-card",
  name: "Rotating Chart Card",
  description: "A custom card for rotating Power and Efficiency charts.",
  preview: true,
  documentationURL: "https://github.com/daylehouse/rotating-chart-card"
});
