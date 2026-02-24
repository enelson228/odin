import { create } from 'zustand';
import { SyncStatus } from '../../shared/types';

interface AppStore {
  sidebarCollapsed: boolean;
  currentView: string;
  syncStatuses: SyncStatus[];
  toggleSidebar: () => void;
  setCurrentView: (view: string) => void;
  setSyncStatuses: (statuses: SyncStatus[]) => void;
  fetchSyncStatuses: () => Promise<void>;
  getIsSyncing: () => boolean;
  getLastSyncTime: () => string | null;
}

export const useAppStore = create<AppStore>((set, get) => ({
  sidebarCollapsed: false,
  currentView: 'Dashboard',
  syncStatuses: [],

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setCurrentView: (view: string) => set({ currentView: view }),

  setSyncStatuses: (statuses: SyncStatus[]) => set({ syncStatuses: statuses }),

  fetchSyncStatuses: async () => {
    try {
      const statuses = await window.odinApi.getSyncStatus();
      set({ syncStatuses: statuses });
    } catch (error) {
      console.error('Failed to fetch sync statuses:', error);
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
