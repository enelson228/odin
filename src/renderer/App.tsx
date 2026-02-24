import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { Dashboard } from './views/Dashboard';
import { MapView } from './views/MapView';
import { CountryList } from './views/CountryList';
import { CountryDetail } from './views/CountryDetail';
import { Settings } from './views/Settings';
import { ROUTES } from './lib/constants';
import { useAppStore } from './stores/app-store';

export function App() {
  const fetchSyncStatuses = useAppStore(s => s.fetchSyncStatuses);

  // Centralized sync status polling — avoids duplicate intervals in Sidebar/TopBar
  useEffect(() => {
    fetchSyncStatuses();
    const interval = setInterval(fetchSyncStatuses, 30_000);
    return () => clearInterval(interval);
  }, [fetchSyncStatuses]);

  return (
    <Shell>
      <Routes>
        <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
        <Route path={ROUTES.MAP} element={<MapView />} />
        <Route path={ROUTES.COUNTRIES} element={<CountryList />} />
        <Route path={ROUTES.COUNTRY_DETAIL} element={<CountryDetail />} />
        <Route path={ROUTES.SETTINGS} element={<Settings />} />
      </Routes>
    </Shell>
  );
}
