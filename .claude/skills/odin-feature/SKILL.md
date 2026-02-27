---
name: odin-feature
description: Full workflow for adding a new feature to the Forunner/odin Electron app. Covers exploration, planning, implementation via the IPC chain, TypeScript build verification, and step documentation. Use for any non-trivial feature addition or change.
argument-hint: [feature description]
---

Implement a new feature in the Odin app end-to-end.

**Feature:** $ARGUMENTS

---

## Step 1: Swarm Explore

Run `/swarm $ARGUMENTS` to launch parallel agents and understand:
- Which of the 7 IPC layers this feature touches
- Existing patterns to follow (look at a similar existing feature first)
- Any shared types that need updating

Do NOT skip this step for features that touch more than one file.

---

## Step 2: Plan

Use `EnterPlanMode` to design the implementation. The plan must identify:
- Every file that changes and what changes in it
- Whether this is a request channel, push event channel, or UI-only change
- The new channel name(s) following the `domain:action` convention (e.g. `sync:clear-log`)
- Verification steps

---

## Step 3: Implement via IPC Chain

Follow `/add-ipc-channel` for any new IPC channels. Work through all 7 layers:

```
src/shared/types.ts
src/main/services/database/db.ts
src/main/ipc-handlers.ts
src/main/preload.ts
src/renderer/types/global.d.ts
src/renderer/stores/app-store.ts
src/renderer/views/[view].tsx  (or App.tsx for push events)
```

Key rules:
- Read every file before editing it (the Edit tool requires this)
- For settings keys: add to `WRITABLE_SETTINGS_KEYS` in `ipc-handlers.ts`
- For push events: subscribe in `App.tsx`, not in the view
- Settings read handler (`settings:get`) returns `AppSettingsPublic` — add new fields there too

---

## Step 4: Verify TypeScript

```bash
cd /Users/ericnelson/AI_Projects/Forunner/odin
npm run build
```

Zero errors = all 7 layers are consistent. Fix any errors before proceeding.

---

## Step 5: Document

Run `/step-doc [feature-name]` to write `docs/step-[feature-name].md`.

---

## Odin Architecture Quick Reference

| Layer | File | Role |
|---|---|---|
| Shared types | `src/shared/types.ts` | Interfaces used by both processes |
| Database | `src/main/services/database/db.ts` | SQLite via better-sqlite3 |
| IPC handlers | `src/main/ipc-handlers.ts` | Main-process request/push registration |
| Preload bridge | `src/main/preload.ts` | Security boundary, exposes `window.odinApi` |
| Renderer types | `src/renderer/types/global.d.ts` | TypeScript types for `window.odinApi` |
| Global store | `src/renderer/stores/app-store.ts` | Zustand store for shared renderer state |
| Views | `src/renderer/views/` | React views; App.tsx for push event subscriptions |
