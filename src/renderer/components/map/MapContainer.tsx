import React, { useEffect, useRef, useState } from 'react';
import { MapContainer as LeafletMap, useMap } from 'react-leaflet';
import { useMapStore } from '../../stores/map-store';
import { VectorTileLayer, useVectorTileProviders, useTileLoadingState } from './VectorTileLayer';
import 'leaflet/dist/leaflet.css';

interface MapContainerProps {
  children?: React.ReactNode;
  showTileLoadingIndicator?: boolean;
}

function MapViewController() {
  const map = useMap();
  const { viewport, setViewport } = useMapStore();
  const isProgrammaticRef = useRef(false);

  // Effect 1: programmatically sync map position when viewport store changes
  useEffect(() => {
    isProgrammaticRef.current = true;
    map.setView(viewport.center, viewport.zoom);
    const tid = setTimeout(() => {
      isProgrammaticRef.current = false;
    }, 150);
    return () => clearTimeout(tid);
  }, [map, viewport.center[0], viewport.center[1], viewport.zoom]);

  // Effect 2: update store only when the user moves the map
  useEffect(() => {
    const handleMoveEnd = () => {
      if (isProgrammaticRef.current) return;
      const center = map.getCenter();
      setViewport({
        center: [center.lat, center.lng],
        zoom: map.getZoom(),
      });
    };

    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map, setViewport]);

  return null;
}

function TileLoadingIndicator() {
  const { isLoading, loadedTiles } = useTileLoadingState();

  if (!isLoading) return null;

  return (
    <div className="absolute top-4 right-4 z-[1000] bg-odin-bg-secondary/90 backdrop-blur px-3 py-2 rounded border border-odin-border">
      <div className="flex items-center gap-2 text-xs font-mono text-odin-text-secondary">
        <div className="w-3 h-3 border border-odin-cyan border-t-transparent rounded-full animate-spin" />
        <span>Loading tiles...</span>
        <span className="text-odin-cyan">{loadedTiles} loaded</span>
      </div>
    </div>
  );
}

export function MapContainer({ children, showTileLoadingIndicator = true }: MapContainerProps) {
  const { viewport } = useMapStore();
  const providers = useVectorTileProviders();
  const [selectedProvider, setSelectedProvider] = useState(0);

  return (
    <div className="h-full w-full relative">
      <LeafletMap
        center={viewport.center}
        zoom={viewport.zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
        // Performance optimizations for large datasets
        preferCanvas={true}
      >
        <VectorTileLayer provider={providers[selectedProvider]} />
        <MapViewController />
        {children}
      </LeafletMap>

      {showTileLoadingIndicator && <TileLoadingIndicator />}

      {/* Map style selector */}
      <div className="absolute top-4 left-4 z-[1000]">
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(Number(e.target.value))}
          className="bg-odin-bg-secondary/90 backdrop-blur text-odin-text-primary text-xs font-mono px-3 py-2 rounded border border-odin-border focus:outline-none focus:border-odin-cyan cursor-pointer"
        >
          {providers.map((provider, idx) => (
            <option key={idx} value={idx}>
              {provider.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
