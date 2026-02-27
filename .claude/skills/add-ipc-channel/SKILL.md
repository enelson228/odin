---
name: add-ipc-channel
description: Add a new IPC channel to the Odin Electron app. Walks through all 7 layers of the IPC chain so TypeScript catches any missing piece at compile time. Use whenever adding a new request-response or push-event channel between main and renderer.
argument-hint: [channel-name] [request|push]
---

Add a new IPC channel to the Odin app. All 7 layers must be updated or the TypeScript
build will fail.

**Channel:** $0
**Type:** $1 (request = ipcMain.handle / ipcRenderer.invoke; push = webContents.send / ipcRenderer.on)

---

## The 7-Layer IPC Chain

Work through each layer in order. Read each file before editing it.

### Layer 1 — `src/shared/types.ts`
Add any new TypeScript interfaces or types needed by this channel. This file is imported
by both main and renderer so it is the single source of truth for shared shapes.

### Layer 2 — `src/main/services/database/db.ts`
If this channel needs DB access, add a method to `DatabaseService`:
```ts
myMethod(params): ReturnType {
  return this.db.prepare('SELECT ...').all(params) as ReturnType;
}
```
Also add to `DEFAULT_SETTINGS` if it's a new settings key.

### Layer 3 — `src/main/ipc-handlers.ts`
Register the handler inside `registerIpcHandlers`:
```ts
ipcMain.handle('channel:name', (_event, arg) => {
  return db.myMethod(arg);
});
```
If it's a **settings write**, add the key to `WRITABLE_SETTINGS_KEYS`.
If it's a **push event**, emit from the scheduler or wherever the event fires:
```ts
win.webContents.send('channel:name', payload);
```

### Layer 4 — `src/main/preload.ts`
Add to the `OdinApi` interface AND the `odinApi` implementation object:

**Request channel:**
```ts
// Interface:
myMethod(arg: ArgType): Promise<ReturnType>;
// Implementation:
myMethod: (arg: ArgType) => ipcRenderer.invoke('channel:name', arg),
```

**Push channel:**
```ts
// Interface:
onMyEvent(callback: (data: DataType) => void): () => void;
// Implementation:
onMyEvent: (callback) => {
  const handler = (_event: Electron.IpcRendererEvent, data: DataType) => callback(data);
  ipcRenderer.on('channel:name', handler);
  return () => ipcRenderer.removeListener('channel:name', handler);
},
```

### Layer 5 — `src/renderer/types/global.d.ts`
Mirror the addition in the `OdinApi` window interface. Must match Layer 4 exactly.

### Layer 6 — `src/renderer/stores/app-store.ts`
If this channel needs state tracked globally, add to the Zustand store:
```ts
// State field:
myData: ReturnType[];
// Action:
fetchMyData: async () => {
  const data = await window.odinApi.myMethod(arg);
  set({ myData: data });
},
```
For **push events**, add an `updateMyData(item)` action that merges into existing state.

### Layer 7 — Renderer (view / App.tsx)
Wire up in the appropriate place:

**Request channels:** call from the relevant view's `useEffect` or event handler.

**Push event channels:** subscribe in `App.tsx` so the listener lives for the entire
app lifetime:
```tsx
useEffect(() => {
  const unsub = window.odinApi.onMyEvent((data) => {
    updateMyData(data);
    // If the event signals completion, also refresh full state:
    if (data.status !== 'in-progress') fetchMyData();
  });
  return unsub;
}, [updateMyData, fetchMyData]);
```

---

## After All Layers

Run `npm run build` from `Forunner/odin/`. A clean build (zero TypeScript errors) confirms
all 7 layers are consistent.

Then run `/step-doc` to document the change.
