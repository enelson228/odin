import React, { useEffect, useState } from 'react';
import { CircleMarker, Popup } from 'react-leaflet';
import type { MilitaryInstallation } from '../../../shared/types';

const ODIN_GREEN = '#00ff88';

export function MilitaryLayer() {
  const [installations, setInstallations] = useState<MilitaryInstallation[]>([]);

  useEffect(() => {
    const fetchInstallations = async () => {
      try {
        const data = await window.odinApi.getInstallations();
        setInstallations(data);
      } catch (error) {
        console.error('Failed to fetch installations:', error);
      }
    };

    fetchInstallations();
  }, []);

  return (
    <>
      {installations.map((installation) => (
        <CircleMarker
          key={installation.id}
          center={[installation.latitude, installation.longitude]}
          radius={5}
          fillColor={ODIN_GREEN}
          color={ODIN_GREEN}
          weight={1}
          opacity={0.8}
          fillOpacity={0.5}
        >
          <Popup>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }}>
              <div style={{ color: ODIN_GREEN, fontWeight: 'bold', marginBottom: '4px' }}>
                {installation.name || 'Military Installation'}
              </div>
              <div style={{ color: '#e0e6ed', marginBottom: '2px' }}>
                <strong>Type:</strong> {installation.type}
              </div>
              {installation.operator && (
                <div style={{ color: '#e0e6ed' }}>
                  <strong>Operator:</strong> {installation.operator}
                </div>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
