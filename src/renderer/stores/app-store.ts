import { create } from 'zustand';
import { SyncStatus } from '../../shared/types';
import { setDisplayTimezone as applyTimezoneToFormatters } from '../lib/format';

interface AppStore {
  sidebarCollapsed: boolean;
  currentView: string;
  syncStatuses: SyncStatus[];
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
  displayTimezone: '',

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setCurrentView: (view: string) => set({ currentView: view }),

  setSyncStatuses: (statuses: SyncStatus[]) => set({ syncStatuses: statuses }),

  updateSyncStatus: (status: SyncStatus) =>
    set((state) => {
      const idx = state.syncStatuses.findIndex((s) => s.adapter === status.adapter);
      if (idx >= 0) {
        const updated = [...state.syncStatuses];
        updated[idx] = status;
        return { syncStatuses: updated };
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
      const s = await window.odinApi.getSettings();
      applyTimezoneToFormatters(s.displayTimezone);
      set({ displayTimezone: s.displayTimezone });
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
