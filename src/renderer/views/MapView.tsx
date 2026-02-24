import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/app-store';
import { useMapStore } from '../stores/map-store';
import { MapContainer } from '../components/map/MapContainer';
import { ConflictLayer } from '../components/map/ConflictLayer';
import { MilitaryLayer } from '../components/map/MilitaryLayer';
import { CountryLayer } from '../components/map/CountryLayer';
import { LayerControls } from '../components/map/LayerControls';
import { ArmsFlowLayer } from '../components/map/ArmsFlowLayer';
import type { ArmsTransfer, Country } from '../../shared/types';

export function MapView() {
  const { setCurrentView } = useAppStore();
  const { layers } = useMapStore();
  const [armsTransfers, setArmsTransfers] = useState<ArmsTransfer[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    setCurrentView('Intelligence Map');
  }, [setCurrentView]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [arms, countriesData] = await Promise.all([
          window.odinApi.getArmsTransfers(),
          window.odinApi.getCountries(),
        ]);
        setArmsTransfers(arms);
        setCountries(countriesData);
      } catch (error) {
        console.error('Failed to fetch map data:', error);
      }
    };

    fetchData();
  }, []);

  const isLayerVisible = (layerId: string) =>
    layers.find((l) => l.id === layerId)?.visible || false;

  return (
    <div className="h-full -m-6">
      <MapContainer>
        {isLayerVisible('countries') && <CountryLayer />}
        {isLayerVisible('conflicts-cluster') && <ConflictLayer />}
        {isLayerVisible('military') && <MilitaryLayer />}
        <ArmsFlowLayer
          transfers={armsTransfers}
          countries={countries}
          visible={isLayerVisible('arms-flow')}
        />
        <LayerControls />
      </MapContainer>
    </div>
  );
}
