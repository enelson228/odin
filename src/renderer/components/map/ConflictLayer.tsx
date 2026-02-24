import React, { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { ConflictEvent } from '../../../shared/types';
import { formatDate } from '../../lib/format';

const ODIN_COLORS = {
  battles: '#ff3d3d',
  explosions: '#ffab00',
  protests: '#00e5ff',
  riots: '#b388ff',
  strategic: '#00ff88',
  default: '#00e5ff',
};

const eventTypeColors: Record<string, string> = {
  'Battles': ODIN_COLORS.battles,
  'Explosions/Remote violence': ODIN_COLORS.explosions,
  'Violence against civilians': ODIN_COLORS.battles,
  'Protests': ODIN_COLORS.protests,
  'Riots': ODIN_COLORS.riots,
  'Strategic developments': ODIN_COLORS.strategic,
};

export function ConflictLayer() {
  const map = useMap();
  const [conflicts, setConflicts] = useState<ConflictEvent[]>([]);
  // Use ref to avoid closure capturing the wrong cluster instance during cleanup
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const fetchConflicts = async () => {
      try {
        const data = await window.odinApi.getConflicts();
        setConflicts(data);
      } catch (error) {
        console.error('Failed to fetch conflicts:', error);
      }
    };

    fetchConflicts();
  }, []);

  useEffect(() => {
    if (!map) return;

    // Remove previous cluster before creating a new one
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (c) => {
        const count = c.getChildCount();
        return L.divIcon({
          html: `<div style="background: rgba(0, 229, 255, 0.2); border: 2px solid ${ODIN_COLORS.default}; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: ${ODIN_COLORS.default}; font-weight: bold; font-size: 12px;">${count}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40),
        });
      },
    });

    conflicts.forEach((event) => {
      const color = eventTypeColors[event.event_type] ?? ODIN_COLORS.default;
      const marker = L.circleMarker([event.latitude, event.longitude], {
        radius: 6,
        fillColor: color,
        color: color,
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.6,
      });

      marker.bindPopup(`
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">
          <div style="color: ${ODIN_COLORS.default}; font-weight: bold; margin-bottom: 4px;">${event.event_type}</div>
          <div style="color: #8899aa; margin-bottom: 4px;">${formatDate(event.event_date)}</div>
          <div style="color: #e0e6ed; margin-bottom: 2px;"><strong>Location:</strong> ${event.location}</div>
          <div style="color: #e0e6ed; margin-bottom: 2px;"><strong>Actor:</strong> ${event.actor1}</div>
          ${event.actor2 ? `<div style="color: #e0e6ed; margin-bottom: 2px;"><strong>vs:</strong> ${event.actor2}</div>` : ''}
          <div style="color: ${ODIN_COLORS.battles};"><strong>Fatalities:</strong> ${event.fatalities}</div>
        </div>
      `);

      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
    clusterRef.current = cluster;

    return () => {
      map.removeLayer(cluster);
      clusterRef.current = null;
    };
  }, [map, conflicts]);

  return null;
}
