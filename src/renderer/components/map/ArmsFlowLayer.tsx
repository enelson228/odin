import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { ArmsTransfer, Country } from '@shared/types';

interface ArmsFlowLayerProps {
  transfers: ArmsTransfer[];
  countries: Country[];
  visible: boolean;
}

const ISO3_CENTROIDS: Record<string, [number, number]> = {
  USA: [38.0, -97.0], RUS: [61.5, 105.0], CHN: [35.0, 103.0],
  DEU: [51.2, 10.5], FRA: [46.6, 2.3], GBR: [55.4, -3.4],
  IND: [20.6, 79.0], PAK: [30.4, 69.3], SAU: [24.0, 45.0],
  ISR: [31.5, 34.8], IRN: [32.4, 53.7], TUR: [39.9, 32.9],
  KOR: [35.9, 127.8], JPN: [36.2, 138.3], AUS: [-25.3, 133.8],
  BRA: [-10.8, -52.9], ZAF: [-29.0, 25.1], EGY: [26.8, 29.9],
  NGA: [9.1, 8.7], UKR: [48.4, 31.2], POL: [52.1, 19.4],
  ITA: [42.8, 12.8], ESP: [40.5, -3.7], CAN: [56.1, -106.3],
  ARE: [24.0, 54.0], QAT: [25.4, 51.2], IDN: [-0.8, 113.9],
  MYS: [2.5, 112.5], THA: [15.9, 100.9], VNM: [14.1, 108.3],
  PHL: [12.9, 121.8], SGP: [1.3, 103.8], NLD: [52.1, 5.3],
  SWE: [60.1, 18.6], NOR: [60.5, 8.5], DNK: [56.3, 9.5],
  BLR: [53.7, 28.0], KAZ: [48.0, 68.0], IRQ: [33.2, 43.7],
  SYR: [35.0, 38.0], YEM: [15.6, 48.5], LBY: [27.0, 17.0],
  MAR: [31.8, -7.1], DZA: [28.0, 1.7], TUN: [33.9, 9.6],
  ETH: [9.1, 40.5], KEN: [-0.0, 37.9], TZA: [-6.4, 34.9],
  AGO: [-11.2, 17.9], COD: [-4.0, 21.8], SDN: [12.9, 30.2],
  ARG: [-34.0, -64.0], CHL: [-30.0, -71.0], COL: [4.1, -72.3],
  VEN: [6.4, -66.6], PER: [-9.2, -75.0], MEX: [23.6, -102.6],
  CZE: [49.8, 15.5], HUN: [47.2, 19.5], ROU: [45.9, 24.9],
  GRC: [39.1, 21.8], BGR: [42.7, 25.5], SRB: [44.0, 20.9],
  TWN: [23.7, 121.0], MMR: [19.2, 96.7], BGD: [23.7, 90.4],
};

function curvedPath(
  startLat: number, startLng: number,
  endLat: number, endLng: number,
  steps = 40
): L.LatLngExpression[] {
  const dLat = endLat - startLat;
  const dLng = endLng - startLng;
  const midLat = (startLat + endLat) / 2;
  const midLng = (startLng + endLng) / 2;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  const offsetScale = Math.min(dist * 0.35, 25);
  const ctrlLat = midLat - dLng * offsetScale / dist;
  const ctrlLng = midLng + dLat * offsetScale / dist;

  const points: L.LatLngExpression[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = (1 - t) * (1 - t) * startLat + 2 * (1 - t) * t * ctrlLat + t * t * endLat;
    const lng = (1 - t) * (1 - t) * startLng + 2 * (1 - t) * t * ctrlLng + t * t * endLng;
    points.push([lat, lng]);
  }
  return points;
}

function getCountryCentroid(iso3: string): [number, number] | null {
  return ISO3_CENTROIDS[iso3] ?? null;
}

export function ArmsFlowLayer({ transfers, countries: _countries, visible }: ArmsFlowLayerProps) {
  const map = useMap();
  const linesRef = useRef<L.Polyline[]>([]);

  useEffect(() => {
    linesRef.current.forEach(line => map.removeLayer(line));
    linesRef.current = [];

    if (!visible || transfers.length === 0) return;

    const pairMap = new Map<string, {
      supplierIso3: string;
      recipientIso3: string;
      totalTiv: number;
      count: number;
    }>();

    transfers.forEach(t => {
      const key = `${t.supplier_iso3}→${t.recipient_iso3}`;
      const existing = pairMap.get(key);
      if (existing) {
        existing.totalTiv += t.tiv_delivered ?? 0;
        existing.count++;
      } else {
        pairMap.set(key, {
          supplierIso3: t.supplier_iso3,
          recipientIso3: t.recipient_iso3,
          totalTiv: t.tiv_delivered ?? 0,
          count: 1,
        });
      }
    });

    const tivValues = Array.from(pairMap.values()).map(p => p.totalTiv).filter(v => v > 0);
    const maxTiv = tivValues.length > 0 ? Math.max(...tivValues) : 1;

    pairMap.forEach(pair => {
      const supplierPos = getCountryCentroid(pair.supplierIso3);
      const recipientPos = getCountryCentroid(pair.recipientIso3);

      if (!supplierPos || !recipientPos) return;
      if (pair.supplierIso3 === pair.recipientIso3) return;

      const tivRatio = Math.max(pair.totalTiv / maxTiv, 0.05);
      const weight = Math.max(1, Math.round(tivRatio * 5));
      const opacity = 0.3 + tivRatio * 0.5;

      const path = curvedPath(supplierPos[0], supplierPos[1], recipientPos[0], recipientPos[1]);

      const line = L.polyline(path, {
        color: '#b388ff',
        weight,
        opacity,
        smoothFactor: 1,
      });

      line.bindPopup(`
        <div style="font-family: monospace; font-size: 11px; background: #111822; color: #e0e6ed; padding: 8px; border: 1px solid #1e2d3d; border-radius: 4px; min-width: 160px;">
          <div style="color: #b388ff; font-weight: bold; margin-bottom: 4px;">Arms Transfer</div>
          <div><span style="color:#8899aa">From:</span> ${pair.supplierIso3}</div>
          <div><span style="color:#8899aa">To:</span> ${pair.recipientIso3}</div>
          <div><span style="color:#8899aa">TIV:</span> <span style="color:#00e5ff">${pair.totalTiv.toLocaleString()}</span></div>
          <div><span style="color:#8899aa">Transfers:</span> ${pair.count}</div>
        </div>
      `);

      map.addLayer(line);
      linesRef.current.push(line);
    });

    return () => {
      linesRef.current.forEach(line => map.removeLayer(line));
      linesRef.current = [];
    };
  }, [map, transfers, visible]);

  return null;
}
