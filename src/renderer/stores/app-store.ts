import { create } from 'zustand';
import type { SyncStatus, AppSettingsPublic } from '../../shared/types';
import { setDisplayTimezone as applyTimezoneToFormatters } from '../lib/format';

interface AppStore {
  sidebarCollapsed: boolean;
  currentView: string;
  syncStatuses: SyncStatus[];
  settings: AppSettingsPublic | null;
  displayTimezone: string;

  toggleSidebar: () => void;
  setCurrentView: (view: string) => void;
  setSyncStatuses: (statuses: SyncStatus[]) => void;
  updateSyncStatus: (status: SyncStatus) => void;
  fetchSyncStatuses: () => Promise<void>;
  setDisplayTimezone: (tz: string) => void;
  initSettings: () => Promise<void>;
  getIsSyncing: () => boolean;
  getLastSyncTime: () => string | null;
}

export const useAppStore = create<AppStore>((set, get) => ({
  sidebarCollapsed: false,
  currentView: 'Dashboard',
  syncStatuses: [],
  settings: null,
  displayTimezone: '',

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setCurrentView: (view: string) => set({ currentView: view }),

  setSyncStatuses: (statuses: SyncStatus[]) => set({ syncStatuses: statuses }),

  /**
   * Upsert a single adapter's sync status — used by the onSyncProgress listener
   * so individual adapter updates don't clobber other statuses.
   */
  updateSyncStatus: (status: SyncStatus) =>
    set((state) => {
      const existing = state.syncStatuses.find(s => s.adapter === status.adapter);
      if (existing) {
        return {
          syncStatuses: state.syncStatuses.map(s =>
            s.adapter === status.adapter ? status : s,
          ),
        };
      }
      return { syncStatuses: [...state.syncStatuses, status] };
    }),

  fetchSyncStatuses: async () => {
    try {
      const statuses = await window.odinApi.getSyncStatus();
      set({ syncStatuses: statuses });
    } catch (error) {
      console.error('Failed to fetch sync statuses:', error);
    }
  },

  setDisplayTimezone: (tz: string) => {
    applyTimezoneToFormatters(tz);
    set({ displayTimezone: tz });
  },

  initSettings: async () => {
    try {
      const settings = await window.odinApi.getSettings();
      applyTimezoneToFormatters(settings.displayTimezone);
      set({
        settings,
        displayTimezone: settings.displayTimezone ?? '',
      });
    } catch (error) {
      console.error('Failed to init settings:', error);
    }
  },

  getIsSyncing: () => get().syncStatuses.some(s => s.status === 'syncing'),

  getLastSyncTime: () => {
    const times = get().syncStatuses
      .map(s => s.lastSync)
      .filter((t): t is string => t !== null);
    return times.length > 0 ? times.sort().reverse()[0] : null;
  },
}));
