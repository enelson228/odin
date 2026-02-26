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
  const updateSyncStatus = useAppStore(s => s.updateSyncStatus);
  const initSettings = useAppStore(s => s.initSettings);

  // Load persisted settings (timezone, etc.) before rendering any dates
  useEffect(() => {
    initSettings();
  }, [initSettings]);

  // Centralized sync status polling — keeps status fresh between push events
  useEffect(() => {
    fetchSyncStatuses();
    const interval = setInterval(fetchSyncStatuses, 30_000);
    return () => clearInterval(interval);
  }, [fetchSyncStatuses]);

  // Subscribe to real-time sync progress events from the main process
  useEffect(() => {
    const unsubscribe = window.odinApi.onSyncProgress((status) => {
      updateSyncStatus(status);
      // Refresh full status list after a sync completes or errors
      if (status.status !== 'syncing') {
        fetchSyncStatuses();
      }
    });
    return unsubscribe;
  }, [updateSyncStatus, fetchSyncStatuses]);

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
