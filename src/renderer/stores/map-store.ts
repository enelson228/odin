import { create } from 'zustand';
import type { MapLayer, MapViewport } from '../../shared/types';

interface MapStore {
  viewport: MapViewport;
  layers: MapLayer[];
  choroplethMetric: string;

  setViewport: (viewport: MapViewport) => void;
  toggleLayer: (layerId: string) => void;
  setChoroplethMetric: (metric: string) => void;
}

const LAYER_VISIBILITY_KEY = 'odin-layer-visibility';

function loadPersistedVisibility(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(LAYER_VISIBILITY_KEY);
    return stored ? (JSON.parse(stored) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function persistVisibility(layers: MapLayer[]): void {
  try {
    const map: Record<string, boolean> = {};
    layers.forEach(l => { map[l.id] = l.visible; });
    localStorage.setItem(LAYER_VISIBILITY_KEY, JSON.stringify(map));
  } catch { /* ignore quota errors */ }
}

const baseLayers: MapLayer[] = [
  { id: 'countries', label: 'Countries (Choropleth)', visible: true, type: 'choropleth' },
  { id: 'conflicts-cluster', label: 'Conflict Events (Clusters)', visible: true, type: 'cluster' },
  { id: 'conflicts-heat', label: 'Conflict Heatmap', visible: false, type: 'heatmap' },
  { id: 'military', label: 'Military Installations', visible: true, type: 'marker' },
  { id: 'arms-flow', label: 'Arms Transfer Flows', visible: false, type: 'flow' },
];

const persistedVisibility = loadPersistedVisibility();
const initialLayers: MapLayer[] = baseLayers.map(layer => ({
  ...layer,
  visible: persistedVisibility[layer.id] ?? layer.visible,
}));

export const useMapStore = create<MapStore>((set) => ({
  viewport: {
    center: [20, 0],
    zoom: 3,
  },
  layers: initialLayers,
  choroplethMetric: 'military_expenditure_pct_gdp',

  setViewport: (viewport: MapViewport) =>
    set((state) => {
      const [lat, lng] = state.viewport.center;
      const [nextLat, nextLng] = viewport.center;
      const sameCenter =
        Math.abs(lat - nextLat) < 1e-6 && Math.abs(lng - nextLng) < 1e-6;
      const sameZoom = state.viewport.zoom === viewport.zoom;
      if (sameCenter && sameZoom) {
        return state;
      }
      return { viewport };
    }),

  toggleLayer: (layerId: string) =>
    set((state) => {
      const layers = state.layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      );
      persistVisibility(layers);
      return { layers };
    }),

  setChoroplethMetric: (metric: string) => set({ choroplethMetric: metric }),
}));
