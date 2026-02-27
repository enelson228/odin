# Step: Sync Progress Feedback & Sync Log

## Problem

When the user triggered a manual sync (from the TopBar or Settings), the UI appeared to do
nothing. Buttons would briefly disable/enable but provided no live feedback about what was
happening or whether the sync succeeded or failed.

Three root causes were identified:

1. **`sync:progress` IPC events were emitted by the main process but never subscribed to in
   the renderer.** The `SyncScheduler` correctly calls `emitSyncProgress()` for each adapter,
   but `App.tsx` had no listener for `window.odinApi.onSyncProgress`, so the events were silently
   dropped.

2. **Settings page did not refresh sync statuses after a manual sync completed.** The TopBar
   called `fetchSyncStatuses()` after sync, but the Settings `handleManualSync` did not — so
   the per-adapter status remained stale until the 30-second polling interval fired.

3. **No sync history was exposed to the UI.** Errors were written to `sync_log` in SQLite but
   there was no IPC endpoint or UI to view them.

---

## Changes

### `src/shared/types.ts`
- Added `SyncLogEntry` interface matching the `sync_log` database table schema.

### `src/main/services/database/db.ts`
- Added `getSyncLog(limit = 100): SyncLogEntry[]` — returns recent sync log entries ordered
  newest first.

### `src/main/ipc-handlers.ts`
- Added `sync:get-log` IPC handler that calls `db.getSyncLog(100)`.

### `src/main/preload.ts`
- Added `getSyncLog()` to the `OdinApi` interface and implementation (`ipcRenderer.invoke('sync:get-log')`).

### `src/renderer/types/global.d.ts`
- Added `SyncLogEntry` import and `getSyncLog(): Promise<SyncLogEntry[]>` to the `OdinApi`
  window interface so TypeScript is satisfied in the renderer.

### `src/renderer/stores/app-store.ts`
- Added `updateSyncStatus(status: SyncStatus)` action that patches a single adapter's entry
  in `syncStatuses` (or appends if not found). This enables O(1) live updates from IPC events
  without replacing the entire array.

### `src/renderer/App.tsx`
- Added a `useEffect` that subscribes to `window.odinApi.onSyncProgress` at the app root.
  On each event, it calls `updateSyncStatus` (instant local update) and, when a sync
  transitions out of `'syncing'` state, also calls `fetchSyncStatuses` to get the authoritative
  DB-persisted record.

### `src/renderer/components/layout/TopBar.tsx`
- Added `activeAdapter` — derived from `syncStatuses` as the first entry with `status === 'syncing'`.
- The TopBar now shows `⟳ ADAPTERNAME` (animated pulse) in the status area while any adapter
  is active, even when the sync was triggered from a different part of the UI.
- Sync button is disabled whenever `syncing || activeAdapter` (prevents double-firing).

### `src/renderer/views/Settings.tsx`
- Refactored manual sync buttons into an `AdapterRow` component that:
  - Shows an animated progress bar under the button while syncing.
  - Displays the last-sync timestamp when idle.
  - Shows the error message in red when the adapter's last status is `'error'`.
  - Shows the record count in the DB when idle and non-zero.
- After `handleManualSync` completes, calls `fetchSyncStatuses()` to immediately refresh state.
- Added a `SyncLogPanel` component at the bottom of Settings that:
  - Fetches and displays the 100 most recent `sync_log` entries in a table.
  - Shows adapter name, status (color-coded), start time, records fetched, and records upserted.
  - Lists any error messages in a highlighted block below the table.
  - Collapses to the 5 most recent entries with a "Show all N entries" toggle.
  - Automatically refreshes whenever a sync completes (via `onSyncProgress`).
  - Has a manual ↻ Refresh button.

---

## Data Flow (After)

```
User clicks "Sync ACLED" in Settings
    │
    ▼
window.odinApi.startSync('acled')          [IPC invoke → main process]
    │                                       [SyncScheduler.syncAdapter('acled')]
    │
    ├─ emitSyncProgress({ status: 'syncing', adapter: 'acled' })
    │      │
    │      ▼  [IPC push → renderer, App.tsx listener]
    │      updateSyncStatus({ adapter: 'acled', status: 'syncing' })
    │          → AdapterRow shows progress bar + "Syncing ACLED..."
    │          → TopBar shows "⟳ ACLED"
    │
    ├─ [network request runs...]
    │
    ├─ db.logSync('acled', 'completed', fetched, upserted)
    │
    ├─ emitSyncProgress({ status: 'idle', adapter: 'acled', recordCount: N })
    │      │
    │      ▼  [IPC push → renderer]
    │      updateSyncStatus → AdapterRow shows record count + last-sync time
    │      fetchSyncStatuses() → store refreshed from DB
    │      SyncLogPanel auto-refreshes
    │
    └─ IPC invoke resolves → handleManualSync finally block:
           setSyncing({ acled: false })
           fetchSyncStatuses()
```

---

## Testing Checklist

- [ ] Click **Sync ACLED** in Settings — button disables, progress bar appears, TopBar shows `⟳ ACLED`
- [ ] When sync completes, button re-enables, last-sync timestamp updates, record count appears
- [ ] If ACLED credentials are missing, error message appears in red under the button
- [ ] Sync Log panel populates after any sync with correct status colors and timestamps
- [ ] Error entries show their message in the highlighted error block
- [ ] TopBar **⟳ Sync** button triggers all adapters sequentially; adapter name in status area updates as each one runs
- [ ] "Show all N entries" toggle works in Sync Log
- [ ] ↻ Refresh button reloads the Sync Log
