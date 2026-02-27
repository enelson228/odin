import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Vector tile provider configuration
export interface VectorTileProvider {
  name: string;
  url: string;
  attribution: string;
  style: {
    fillColor: string;
    fillOpacity: number;
    color: string;
    weight: number;
  };
}

const DEFAULT_PROVIDERS: VectorTileProvider[] = [
  {
    name: 'CartoDB Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    style: {
      fillColor: '#1a3a5c',
      fillOpacity: 0.3,
      color: '#2d5a8a',
      weight: 1,
    },
  },
  {
    name: 'CartoDB Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    style: {
      fillColor: '#c8d4e3',
      fillOpacity: 0.3,
      color: '#8fa3bf',
      weight: 1,
    },
  },
  {
    name: 'Stadia OSBright',
    url: 'https://tiles.stadiamaps.com/tiles/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',
    style: {
      fillColor: '#e8eaf0',
      fillOpacity: 0.3,
      color: '#c4c9d6',
      weight: 1,
    },
  },
];

interface VectorTileLayerProps {
  provider?: VectorTileProvider;
  customUrl?: string;
  customAttribution?: string;
  opacity?: number;
  zIndex?: number;
}

export function VectorTileLayer({
  provider,
  customUrl,
  customAttribution,
  opacity = 1,
  zIndex = 1,
}: VectorTileLayerProps) {
  const map = useMap();
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!map) return;

    // Remove existing tile layer if any
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl = customUrl || provider?.url || DEFAULT_PROVIDERS[0].url;
    const attribution = customAttribution || provider?.attribution || DEFAULT_PROVIDERS[0].attribution;

    // Create new tile layer with improved settings
    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution,
      opacity,
      zIndex,
      maxZoom: 19,
      minZoom: 2,
      // Performance optimizations
      keepBuffer: 2,
      updateWhenIdle: false,
      updateWhenZooming: true,
      bounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
    });

    tileLayerRef.current.addTo(map);

    return () => {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
    };
  }, [map, customUrl, customAttribution, provider, opacity, zIndex]);

  return null;
}

// Custom hook for managing vector tile providers
export function useVectorTileProviders() {
  return DEFAULT_PROVIDERS;
}

// Tile loading state hook for monitoring load progress
export function useTileLoadingState() {
  const map = useMap();
  const [loadingTiles, setLoadingTiles] = React.useState(0);
  const [loadedTiles, setLoadedTiles] = React.useState(0);

  useEffect(() => {
    if (!map) return;

    const handleTileLoad = () => {
      setLoadedTiles((prev) => prev + 1);
    };

    const handleTileLoadStart = () => {
      setLoadingTiles((prev) => prev + 1);
    };

    const handleTileLoadError = () => {
      setLoadingTiles((prev) => Math.max(0, prev - 1));
    };

    map.on('tileloadstart', handleTileLoadStart);
    map.on('tileload', handleTileLoad);
    map.on('tileerror', handleTileLoadError);

    return () => {
      map.off('tileloadstart', handleTileLoadStart);
      map.off('tileload', handleTileLoad);
      map.off('tileerror', handleTileLoadError);
    };
  }, [map]);

  return { loadingTiles, loadedTiles, isLoading: loadingTiles > 0 };
}
