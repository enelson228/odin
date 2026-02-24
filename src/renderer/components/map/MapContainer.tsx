import React, { useEffect, useRef } from 'react';
import { MapContainer as LeafletMap, TileLayer, useMap } from 'react-leaflet';
import { useMapStore } from '../../stores/map-store';
import 'leaflet/dist/leaflet.css';

interface MapContainerProps {
  children?: React.ReactNode;
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

export function MapContainer({ children }: MapContainerProps) {
  const { viewport } = useMapStore();

  return (
    <div className="h-full w-full relative">
      <LeafletMap
        center={viewport.center}
        zoom={viewport.zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <MapViewController />
        {children}
      </LeafletMap>
    </div>
  );
}
