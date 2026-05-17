var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
let RotatingChartCardEditor = class RotatingChartCardEditor extends LitElement {
    constructor() {
        super(...arguments);
        // Removed duplicate setConfig property
        this._config = {};
    }
    setConfig(config) {
        this._config = config;
    }
    render() {
        if (!this.hass)
            return html ``;
        return html `
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
    _valueChanged(ev) {
        const target = ev.target;
        const value = ev.detail.value;
        if (this._config[target.configValue] === value)
            return;
        this._config = {
            ...this._config,
            [target.configValue]: value,
        };
        this.setConfig?.(this._config);
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config } }));
    }
};
__decorate([
    property({ type: Object })
], RotatingChartCardEditor.prototype, "hass", void 0);
__decorate([
    state()
], RotatingChartCardEditor.prototype, "_config", void 0);
RotatingChartCardEditor = __decorate([
    customElement("rotating-chart-card-editor")
], RotatingChartCardEditor);
export { RotatingChartCardEditor };
// Export for Home Assistant to find
window.customCards = window.customCards || [];
window.customCards.push({
    type: "rotating-chart-card",
    name: "Rotating Chart Card",
    description: "A custom card for rotating Power and Efficiency charts.",
    preview: true,
    documentationURL: "https://github.com/daylehouse/rotating-chart-card"
});
