import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/app-store';
import { ExportMenu } from '../common/ExportMenu';
import { formatDateTime } from '../../lib/format';

export function TopBar() {
  const { currentView, syncStatuses, fetchSyncStatuses } = useAppStore();
  const [syncing, setSyncing] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    const total = syncStatuses.reduce((sum, s) => sum + s.recordCount, 0);
    setTotalRecords(total);
  }, [syncStatuses]);

  const lastSync = syncStatuses
    .map((s) => s.lastSync)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  // Adapter currently syncing (updated in real-time via sync:progress events in App.tsx)
  const activeAdapter = syncStatuses.find((s) => s.status === 'syncing');

  const handleSync = async () => {
    setSyncing(true);
    try {
      await window.odinApi.startSync();
      await fetchSyncStatuses();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const isBusy = syncing || Boolean(activeAdapter);

  return (
    <header className="bg-odin-bg-secondary border-b border-odin-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-odin-text-primary font-mono">
            {currentView}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-mono text-odin-text-tertiary">
            <span>{totalRecords.toLocaleString()} records</span>
            {lastSync && (
              <>
                <span>•</span>
                <span>Last sync: {formatDateTime(lastSync)}</span>
              </>
            )}
            {activeAdapter && (
              <>
                <span>•</span>
                <span className="text-odin-cyan animate-pulse">
                  ⟳ {activeAdapter.adapter.toUpperCase()}
                </span>
              </>
            )}
          </div>

          <button
            onClick={handleSync}
            disabled={isBusy}
            aria-label="Sync all data sources"
            className="px-3 py-1.5 bg-odin-bg-tertiary border border-odin-border rounded text-sm font-mono text-odin-text-primary hover:border-odin-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBusy ? '⟳ Syncing...' : '⟳ Sync'}
          </button>

          <ExportMenu dataType="all" />
        </div>
      </div>
    </header>
  );
}
