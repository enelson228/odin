import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/app-store';
import { AppSettingsPublic } from '../../shared/types';
import { Spinner } from '../components/common/Spinner';
import { SYNC_INTERVAL_OPTIONS } from '../lib/constants';

export function Settings() {
  const { setCurrentView } = useAppStore();
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
  });
  // Password is tracked separately — never persisted in renderer state
  const [newPassword, setNewPassword] = useState('');
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
      };
      // Only include the password if the user actually typed one
      if (newPassword.length > 0) {
        payload.acledPassword = newPassword;
      }
      await window.odinApi.updateSettings(payload);
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
        <h2 className="text-xl font-bold text-odin-cyan mb-6 font-mono">
          Manual Sync
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['acled', 'worldbank', 'overpass', 'cia-factbook'].map((adapter) => (
            <button
              key={adapter}
              onClick={() => handleManualSync(adapter)}
              disabled={syncing[adapter]}
              className="px-4 py-2 bg-odin-bg-tertiary border border-odin-border rounded text-sm font-mono text-odin-text-primary hover:border-odin-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing[adapter] ? '⟳ Syncing...' : `Sync ${adapter.toUpperCase()}`}
            </button>
          ))}
        </div>
      </div>

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
