import React, { useEffect, useMemo, useState } from 'react';
import { GeoJSON } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import type { Country } from '../../../shared/types';
import { useMapStore } from '../../stores/map-store';

const ODIN_COLORS = {
  choroplethBase: '0, 229, 255',
  border: '#006680',
  borderHover: '#00e5ff',
  noData: 'rgba(0, 229, 255, 0.05)',
};

export function CountryLayer() {
  const navigate = useNavigate();
  const { choroplethMetric } = useMapStore();
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const data = await window.odinApi.getCountries();
        setCountries(data);
      } catch (error) {
        console.error('Failed to fetch countries:', error);
      }
    };

    fetchCountries();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadGeoJSON = async () => {
      try {
        const response = await fetch(
          'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
          { signal: controller.signal }
        );
        const data = await response.json();
        setGeoJsonData(data);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to load GeoJSON:', error);
        }
      }
    };

    loadGeoJSON();
    return () => controller.abort();
  }, []);

  // Compute dynamic min/max for the current metric to normalize choropleth
  const { minValue, maxValue } = useMemo(() => {
    const values = countries
      .map(c => c[choroplethMetric as keyof Country] as number | null)
      .filter((v): v is number => v !== null && isFinite(v));
    if (values.length === 0) return { minValue: 0, maxValue: 1 };
    return { minValue: Math.min(...values), maxValue: Math.max(...values) };
  }, [countries, choroplethMetric]);

  const getCountryValue = (iso3: string): number | null => {
    const country = countries.find((c) => c.iso3 === iso3);
    if (!country) return null;
    return country[choroplethMetric as keyof Country] as number | null;
  };

  const getColorForValue = (value: number | null): string => {
    if (value == null) return ODIN_COLORS.noData;
    const range = maxValue - minValue || 1;
    const normalized = Math.max(0, Math.min((value - minValue) / range, 1));
    const alpha = 0.1 + normalized * 0.6;
    return `rgba(${ODIN_COLORS.choroplethBase}, ${alpha})`;
  };

  const onEachFeature = (feature: any, layer: any) => {
    const iso3 = feature.properties?.ISO_A3;
    if (!iso3) return;

    const value = getCountryValue(iso3);
    const color = getColorForValue(value);

    layer.setStyle({
      fillColor: color,
      weight: 1,
      opacity: 0.6,
      color: ODIN_COLORS.border,
      fillOpacity: 0.5,
    });

    layer.on({
      mouseover: () => {
        layer.setStyle({
          weight: 2,
          color: ODIN_COLORS.borderHover,
          fillOpacity: 0.7,
        });
      },
      mouseout: () => {
        layer.setStyle({
          weight: 1,
          color: ODIN_COLORS.border,
          fillOpacity: 0.5,
        });
      },
      click: () => {
        navigate(`/countries/${iso3}`);
      },
    });

    const country = countries.find((c) => c.iso3 === iso3);
    if (country) {
      layer.bindPopup(`
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">
          <div style="color: #00e5ff; font-weight: bold; margin-bottom: 4px;">${country.name}</div>
          <div style="color: #e0e6ed;">
            <strong>${choroplethMetric}:</strong> ${value ?? '—'}
          </div>
        </div>
      `);
    }
  };

  if (!geoJsonData) return null;

  return (
    <GeoJSON
      key={`country-layer-${countries.length}-${choroplethMetric}`}
      data={geoJsonData}
      onEachFeature={onEachFeature}
    />
  );
}
