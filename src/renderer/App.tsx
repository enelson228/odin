import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { Dashboard } from './views/Dashboard';
import { MapView } from './views/MapView';
import { CountryList } from './views/CountryList';
import { CountryDetail } from './views/CountryDetail';
import { Settings } from './views/Settings';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ROUTES } from './lib/constants';
import { useAppStore } from './stores/app-store';

// Global error handler for logging errors to main process
function handleError(error: Error, errorInfo: React.ErrorInfo): void {
  console.error('[App ErrorBoundary] Global error caught:', error.message);
  // Could send to main process for logging if needed
}

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
    <ErrorBoundary onError={handleError}>
      <Shell>
        <Routes>
          <Route path={ROUTES.DASHBOARD} element={
            <ErrorBoundary>
              <Dashboard />
            </ErrorBoundary>
          } />
          <Route path={ROUTES.MAP} element={
            <ErrorBoundary>
              <MapView />
            </ErrorBoundary>
          } />
          <Route path={ROUTES.COUNTRIES} element={
            <ErrorBoundary>
              <CountryList />
            </ErrorBoundary>
          } />
          <Route path={ROUTES.COUNTRY_DETAIL} element={
            <ErrorBoundary>
              <CountryDetail />
            </ErrorBoundary>
          } />
          <Route path={ROUTES.SETTINGS} element={
            <ErrorBoundary>
              <Settings />
            </ErrorBoundary>
          } />
        </Routes>
      </Shell>
    </ErrorBoundary>
  );
}
