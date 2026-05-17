# Rotating Chart Card

A Home Assistant Lovelace custom card for displaying Power and Efficiency charts with a HUD, inspired by the Crypto Mining Fleet Card. Deployable via HACS.

## Features
- Power and Efficiency charts (Chart.js)
- HUD for real-time stats
- Animated chart marquee
- HACS compatible

## Installation
### HACS
1. Add this repository to HACS as a custom repository (Lovelace integration).
2. Install the card via HACS.
3. Add the card to your Lovelace dashboard.

+### Manual
1. Download the latest `dist/rotating-chart-card.js` from the [releases](https://github.com/daylehouse/rotating-chart-card/releases/latest) or [raw file](https://github.com/daylehouse/rotating-chart-card/raw/main/dist/rotating-chart-card.js).
2. Place it in your `/config/www/` folder.
3. Add the resource to your dashboard:
	 ```yaml
	 resources:
		 - url: /local/rotating-chart-card.js
			 type: module
	 ```
4. Add the card to your Lovelace dashboard.

## Example Card Configuration
```yaml
type: custom:rotating-chart-card
title: Mining Power & Efficiency
fleet_power_entity: sensor.fleet_power
efficiency_chart_entity: sensor.fleet_energy_efficiency
```

See the documentation for more options.

## Credits
- Based on [Crypto Mining Fleet Card](https://github.com/daylehouse/crypo-mining-fleet-card)
