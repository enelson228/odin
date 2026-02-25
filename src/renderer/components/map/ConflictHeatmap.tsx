// ─── Conflict Heatmap Layer ───────────────────────────────────
// Renders a leaflet.heat heatmap for conflict event lat/lng points.
// Uses useMap() to access the underlying Leaflet map instance directly,
// since leaflet.heat is not a react-leaflet component.

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import type { ConflictEvent } from '../../../../shared/types';

// Extend L to include the heatLayer factory added by leaflet.heat
declare module 'leaflet' {
  function heatLayer(
    latlngs: Array<[number, number] | [number, number, number]>,
    options?: {
      minOpacity?: number;
      maxZoom?: number;
      max?: number;
      radius?: number;
      blur?: number;
      gradient?: Record<number, string>;
    },
  ): L.Layer;
}

interface ConflictHeatmapProps {
  events: ConflictEvent[];
}

export function ConflictHeatmap({ events }: ConflictHeatmapProps) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    // Build the points array: [lat, lng, intensity]
    // Use fatalities as intensity weight (clamped to 0–1 scale via max option)
    const points: Array<[number, number, number]> = events
      .filter(e => e.latitude !== 0 || e.longitude !== 0)
      .map(e => [e.latitude, e.longitude, Math.max(1, e.fatalities ?? 1)]);

    // Remove previous layer if it exists
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (points.length === 0) return;

    const heat = L.heatLayer(points, {
      minOpacity: 0.4,
      maxZoom: 10,
      max: 100,           // fatalities cap for color scaling
      radius: 18,
      blur: 22,
      gradient: {
        0.0: '#0e4d6c',   // dark blue
        0.3: '#0891b2',   // odin-cyan (low)
        0.6: '#f59e0b',   // amber (medium)
        0.85: '#ef4444',  // red (high)
        1.0: '#ffffff',   // white (extreme)
      },
    });

    heat.addTo(map);
    layerRef.current = heat;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, events]);

  return null;
}
