import React, { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../stores/app-store';
import { AppSettingsPublic, SyncLogEntry, SyncStatus } from '../../shared/types';
import { Spinner } from '../components/common/Spinner';
import { SYNC_INTERVAL_OPTIONS } from '../lib/constants';
import { formatDateTime } from '../lib/format';

// ─── Sync Log Panel ───────────────────────────────────────

function SyncLogPanel() {
  const [entries, setEntries] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.odinApi.getSyncLog();
      setEntries(data);
    } catch {
      // Non-fatal — log panel is best-effort
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  // Refresh log when a sync completes
  useEffect(() => {
    const unsubscribe = window.odinApi.onSyncProgress((status) => {
      if (status.status !== 'syncing') {
        fetchLog();
      }
    });
    return unsubscribe;
  }, [fetchLog]);

  const statusColor = (status: string) => {
    if (status === 'completed') return 'text-odin-green';
    if (status === 'error') return 'text-odin-red';
    return 'text-odin-text-tertiary';
  };

  const visible = expanded ? entries : entries.slice(0, 5);

  return (
    <div className="bg-odin-bg-secondary border border-odin-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-odin-cyan font-mono">Sync Log</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchLog}
            className="text-xs font-mono text-odin-text-tertiary hover:text-odin-cyan transition-colors"
          >
            ↻ Refresh
          </button>
          <button
            onClick={async () => {
              if (!window.confirm('Delete all sync log entries? This cannot be undone.')) return;
              await window.odinApi.clearSyncLog();
              await fetchLog();
            }}
            className="text-xs font-mono text-odin-text-tertiary hover:text-odin-red transition-colors"
          >
            ✕ Clear
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-16">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs font-mono text-odin-text-tertiary">
          No sync history yet. Run a manual sync to populate this log.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-odin-text-tertiary border-b border-odin-border">
                  <th className="text-left pb-2 pr-4">Adapter</th>
                  <th className="text-left pb-2 pr-4">Status</th>
                  <th className="text-left pb-2 pr-4">Started</th>
                  <th className="text-right pb-2 pr-4">Fetched</th>
                  <th className="text-right pb-2">Upserted</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => (
                  <tr key={entry.id} className="border-b border-odin-border/50 last:border-0">
                    <td className="py-2 pr-4 text-odin-text-primary uppercase">{entry.adapter}</td>
                    <td className={`py-2 pr-4 ${statusColor(entry.status)}`}>
                      {entry.status}
                    </td>
                    <td className="py-2 pr-4 text-odin-text-secondary">
                      {formatDateTime(entry.started_at)}
                    </td>
                    <td className="py-2 pr-4 text-right text-odin-text-secondary">
                      {entry.records_fetched.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-odin-text-secondary">
                      {entry.records_upserted.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Error details for any error entries in the visible set */}
          {visible.some((e) => e.error_message) && (
            <div className="mt-3 space-y-2">
              {visible
                .filter((e) => e.error_message)
                .map((e) => (
                  <div
                    key={e.id}
                    className="bg-odin-red/10 border border-odin-red/30 rounded p-2"
                  >
                    <span className="text-odin-red font-mono text-xs uppercase mr-2">
                      {e.adapter}
                    </span>
                    <span className="text-odin-text-secondary font-mono text-xs">
                      {e.error_message}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {entries.length > 5 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 text-xs font-mono text-odin-cyan hover:underline"
            >
              {expanded ? 'Show less' : `Show all ${entries.length} entries`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Adapter Sync Button ──────────────────────────────────

interface AdapterRowProps {
  adapter: string;
  liveStatus: SyncStatus | undefined;
  onSync: (adapter: string) => void;
  isSyncing: boolean;
}

function AdapterRow({ adapter, liveStatus, onSync, isSyncing }: AdapterRowProps) {
  const isActive = isSyncing || liveStatus?.status === 'syncing';
  const hasError = liveStatus?.status === 'error';

  return (
    <div className="space-y-1">
      <button
        onClick={() => onSync(adapter)}
        disabled={isActive}
        className="w-full px-4 py-2 bg-odin-bg-tertiary border border-odin-border rounded text-sm font-mono text-odin-text-primary hover:border-odin-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left flex items-center justify-between"
      >
        <span>{isActive ? `⟳ Syncing ${adapter.toUpperCase()}...` : `Sync ${adapter.toUpperCase()}`}</span>
        {liveStatus?.lastSync && !isActive && (
          <span className="text-xs text-odin-text-tertiary">
            {formatDateTime(liveStatus.lastSync)}
          </span>
        )}
      </button>

      {/* Live progress bar while syncing */}
      {isActive && (
        <div className="h-1 w-full bg-odin-bg-tertiary rounded overflow-hidden">
          <div className="h-full bg-odin-cyan animate-pulse w-full" />
        </div>
      )}

      {/* Error message */}
      {hasError && liveStatus?.errorMessage && (
        <p className="text-xs font-mono text-odin-red px-1">
          ✗ {liveStatus.errorMessage}
        </p>
      )}

      {/* Success info */}
      {liveStatus?.status === 'idle' && liveStatus.recordCount > 0 && !isActive && (
        <p className="text-xs font-mono text-odin-text-tertiary px-1">
          {liveStatus.recordCount.toLocaleString()} records in db
        </p>
      )}
    </div>
  );
}

// ─── Timezone list ────────────────────────────────────────

const TIMEZONE_OPTIONS: string[] = (() => {
  try {
    return (Intl as { supportedValuesOf?: (key: string) => string[] })
      .supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
})();

// ─── Main Settings View ───────────────────────────────────

export function Settings() {
  const { setCurrentView, syncStatuses, fetchSyncStatuses, setDisplayTimezone } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettingsPublic>({
    acledEmail: '',
    acledHasPassword: false,
    syncIntervalMinutes: 360,
    mapDefaultCenter: [20, 0],
    mapDefaultZoom: 3,
    displayTimezone: '',
  });
  // Password is tracked separately — never persisted in renderer state
  const [newPassword, setNewPassword] = useState('');
  // Track which adapters are currently being synced by this view
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCurrentView('Settings');
  }, [setCurrentView]);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await window.odinApi.getSettings();
        setSettings(data);
      } catch (err) {
        console.error('Failed to fetch settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const payload: Record<string, unknown> = {
        acledEmail: settings.acledEmail,
        syncIntervalMinutes: settings.syncIntervalMinutes,
        mapDefaultCenter: settings.mapDefaultCenter,
        mapDefaultZoom: settings.mapDefaultZoom,
        displayTimezone: settings.displayTimezone,
      };
      // Only include the password if the user actually typed one
      if (newPassword.length > 0) {
        payload.acledPassword = newPassword;
      }
      await window.odinApi.updateSettings(payload);
      // Apply timezone immediately so all displayed dates update without a restart
      setDisplayTimezone(settings.displayTimezone);
      setNewPassword('');
      setSaveMsg('Settings saved.');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSaveMsg('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async (adapter: string) => {
    setSyncing((prev) => ({ ...prev, [adapter]: true }));
    try {
      await window.odinApi.startSync(adapter);
      // Refresh sync statuses after completion
      await fetchSyncStatuses();
    } catch (err) {
      console.error(`Failed to sync ${adapter}:`, err);
    } finally {
      setSyncing((prev) => ({ ...prev, [adapter]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-odin-text-secondary">
        <div className="text-odin-red font-mono text-sm">{error}</div>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            window.odinApi.getSettings().then(setSettings).catch(() => {}).finally(() => setLoading(false));
          }}
          className="px-3 py-1 text-xs font-mono text-odin-cyan border border-odin-cyan rounded hover:bg-odin-cyan/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-odin-bg-secondary border border-odin-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-odin-cyan mb-2 font-mono">
          ACLED Authentication
        </h2>
        <p className="text-xs text-odin-text-tertiary mb-6 font-mono">
          OAuth2 authentication — register at acleddata.com, then enter your
          account email and password. Tokens are managed automatically.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-mono text-odin-text-secondary mb-2">
              ACLED Email
            </label>
            <input
              type="email"
              value={settings.acledEmail}
              onChange={(e) =>
                setSettings({ ...settings, acledEmail: e.target.value })
              }
              className="w-full bg-odin-bg-tertiary border border-odin-border rounded px-3 py-2 text-sm font-mono text-odin-text-primary focus:outline-none focus:border-odin-cyan"
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-mono text-odin-text-secondary mb-2">
              ACLED Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-odin-bg-tertiary border border-odin-border rounded px-3 py-2 text-sm font-mono text-odin-text-primary focus:outline-none focus:border-odin-cyan"
              placeholder={
                settings.acledHasPassword
                  ? 'Password stored — enter new password to replace'
                  : 'Enter your ACLED account password'
              }
            />
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-odin-text-tertiary">Password status:</span>
            {settings.acledHasPassword ? (
              <span className="text-odin-green">● Stored</span>
            ) : (
              <span className="text-odin-text-tertiary">○ Not configured</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-odin-bg-secondary border border-odin-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-odin-cyan mb-6 font-mono">
          Sync Settings
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-mono text-odin-text-secondary mb-2">
              Sync Interval
            </label>
            <select
              value={settings.syncIntervalMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  syncIntervalMinutes: parseInt(e.target.value, 10) || 360,
                })
              }
              className="w-full bg-odin-bg-tertiary border border-odin-border rounded px-3 py-2 text-sm font-mono text-odin-text-primary focus:outline-none focus:border-odin-cyan"
            >
              {SYNC_INTERVAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-odin-bg-secondary border border-odin-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-odin-cyan mb-6 font-mono">
          Map Defaults
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-mono text-odin-text-secondary mb-2">
              Latitude
            </label>
            <input
              type="number"
              value={settings.mapDefaultCenter[0]}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  mapDefaultCenter: [
                    parseFloat(e.target.value),
                    settings.mapDefaultCenter[1],
                  ],
                })
              }
              className="w-full bg-odin-bg-tertiary border border-odin-border rounded px-3 py-2 text-sm font-mono text-odin-text-primary focus:outline-none focus:border-odin-cyan"
            />
          </div>

          <div>
            <label className="block text-sm font-mono text-odin-text-secondary mb-2">
              Longitude
            </label>
            <input
              type="number"
              value={settings.mapDefaultCenter[1]}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  mapDefaultCenter: [
                    settings.mapDefaultCenter[0],
                    parseFloat(e.target.value),
                  ],
                })
              }
              className="w-full bg-odin-bg-tertiary border border-odin-border rounded px-3 py-2 text-sm font-mono text-odin-text-primary focus:outline-none focus:border-odin-cyan"
            />
          </div>

          <div>
            <label className="block text-sm font-mono text-odin-text-secondary mb-2">
              Default Zoom
            </label>
            <input
              type="number"
              min="1"
              max="18"
              value={settings.mapDefaultZoom}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  mapDefaultZoom: parseInt(e.target.value, 10) || 3,
                })
              }
              className="w-full bg-odin-bg-tertiary border border-odin-border rounded px-3 py-2 text-sm font-mono text-odin-text-primary focus:outline-none focus:border-odin-cyan"
            />
          </div>
        </div>
      </div>

      <div className="bg-odin-bg-secondary border border-odin-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-odin-cyan mb-2 font-mono">
          Display
        </h2>
        <p className="text-xs text-odin-text-tertiary mb-6 font-mono">
          Choose the timezone used to display all timestamps in the app.
          Defaults to system local time when left empty.
        </p>

        <div>
          <label className="block text-sm font-mono text-odin-text-secondary mb-2">
            Display Timezone
          </label>
          <select
            value={settings.displayTimezone}
            onChange={(e) => setSettings({ ...settings, displayTimezone: e.target.value })}
            className="w-full bg-odin-bg-tertiary border border-odin-border rounded px-3 py-2 text-sm font-mono text-odin-text-primary focus:outline-none focus:border-odin-cyan"
          >
            <option value="">System local (default)</option>
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-odin-bg-secondary border border-odin-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-odin-cyan mb-2 font-mono">
          Manual Sync
        </h2>
        <p className="text-xs text-odin-text-tertiary mb-4 font-mono">
          Trigger an immediate sync for a specific data source. Progress is
          shown in real time.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['acled', 'worldbank', 'overpass', 'cia-factbook'] as const).map((adapter) => {
            const liveStatus = syncStatuses.find((s) => s.adapter === adapter);
            return (
              <AdapterRow
                key={adapter}
                adapter={adapter}
                liveStatus={liveStatus}
                onSync={handleManualSync}
                isSyncing={Boolean(syncing[adapter])}
              />
            );
          })}
        </div>
      </div>

      {/* Sync Log */}
      <SyncLogPanel />

      <div className="flex items-center justify-end gap-4">
        {saveMsg && (
          <span className={`text-sm font-mono ${saveMsg.startsWith('Failed') ? 'text-odin-red' : 'text-odin-green'}`}>
            {saveMsg}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-odin-cyan text-odin-bg-primary font-bold font-mono rounded hover:bg-odin-cyan/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
