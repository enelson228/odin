import React from 'react';
import { useMap } from 'react-leaflet';
import { useMapStore } from '../../stores/map-store';

const choroplethMetrics = [
  { value: 'military_expenditure_pct_gdp', label: 'Military Spending % GDP' },
  { value: 'population', label: 'Population' },
  { value: 'gdp', label: 'GDP' },
  { value: 'active_personnel', label: 'Active Military Personnel' },
];

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 3;

export function LayerControls() {
  const map = useMap();
  const { layers, toggleLayer, choroplethMetric, setChoroplethMetric, setViewport } = useMapStore();

  const handleResetView = () => {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    setViewport({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
  };

  return (
    <div className="absolute top-4 right-4 bg-odin-bg-secondary border border-odin-border rounded-lg p-4 shadow-lg z-[1000] w-64">
      <h3 className="text-sm font-bold text-odin-cyan mb-3 font-mono uppercase">
        Map Layers
      </h3>

      <div className="space-y-2 mb-4">
        {layers.map((layer) => (
          <label
            key={layer.id}
            className="flex items-center gap-2 cursor-pointer hover:bg-odin-bg-tertiary p-2 rounded transition-colors"
          >
            <input
              type="checkbox"
              checked={layer.visible}
              onChange={() => toggleLayer(layer.id)}
              className="w-4 h-4 accent-odin-cyan"
            />
            <span className="text-sm font-mono text-odin-text-primary">
              {layer.label}
            </span>
          </label>
        ))}
      </div>

      <div className="pt-3 border-t border-odin-border mb-3">
        <button
          onClick={handleResetView}
          aria-label="Reset map to default view"
          className="w-full text-xs font-mono text-odin-cyan border border-odin-border rounded px-2 py-1.5 hover:bg-odin-bg-tertiary transition-colors"
        >
          Reset View
        </button>
      </div>

      <div>
        <label className="block text-xs font-mono text-odin-text-secondary mb-2 uppercase">
          Choropleth Metric
        </label>
        <select
          value={choroplethMetric}
          onChange={(e) => setChoroplethMetric(e.target.value)}
          className="w-full bg-odin-bg-tertiary border border-odin-border rounded px-2 py-1.5 text-sm font-mono text-odin-text-primary focus:outline-none focus:border-odin-cyan"
        >
          {choroplethMetrics.map((metric) => (
            <option key={metric.value} value={metric.value}>
              {metric.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
