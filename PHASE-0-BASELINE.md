# Beacon Phase 0 Baseline — 2026-09-21

## Purpose

This branch preserves the exact current `main` state before functional repair work begins.

## Snapshot

- Repository: `tinsu-at/beacon-offline-upgrade`
- Baseline branch: `phase-0-baseline-2026-09-21`
- Main snapshot commit: `c7b514a037ef7311aadc44b8d2a9c33afc9378fe`
- Default branch: `main`

## Confirmed code findings

### 1. Build-blocking syntax error

`vite.config.ts` contains literal backslash-n characters inside the `tanstackStart` object on line 7 instead of real line breaks.

This is invalid TypeScript and was reproduced independently with TypeScript 5.8:

- TS1127: Invalid character
- TS1005: ',' expected

This occurs before the workflow reaches `npx cap sync android`.

### 2. Capacitor static-bundle/server mismatch

`capacitor.config.ts` currently removes `server.url` and tells Capacitor to load the bundled `dist/client` build.

The application still contains TanStack Start server functions and a server-side `/api/chat` route. A self-contained static bundle cannot execute those server functions locally. The Android app therefore needs an explicit online-server bridge/base URL for cloud chat/server functions, while keeping offline features local.

### 3. Offline cache is not yet a true local database

React Query persistence uses one global localStorage key:

`beacon-query-cache-v2`

It is not scoped by `user_id`. Switching accounts on the same device can leave cached query data from the previous account available to the next account, especially while offline.

### 4. Notification preferences are not user-scoped

`src/lib/notifications.ts` uses the global key `beacon-notif-prefs-v2`, and the first-launch flag `beacon-notif-primed` is also global.

For multi-user operation these must be scoped per authenticated user.

### 5. Offline storage is localStorage-based

The offline outbox is scoped by user, which is good, but both cache and outbox are plain localStorage. This is suitable as an interim bridge, not the final encrypted local-first storage architecture.

### 6. Server-side user isolation needs defense-in-depth

Several server functions rely on Supabase RLS for isolation instead of also filtering explicitly by `context.userId`. RLS policies must be verified before multi-user rollout. Examples include conversation and missing-memory embedding operations.

### 7. Current UI is still the previous navigation design

Current mobile navigation is Home / Chat / Tasks / Habits / More. The planned final architecture is Home / Work / Journal / Memory / More, with Chat as the central interaction rather than a primary bottom-tab destination.

### 8. Current color system differs from the planned Beacon design

The current stylesheet is Royal Blue / Cream / Pale Cyan. The planned Beacon identity uses the previously selected pale pink/rose and deep burgundy/red accent system. This is a design-phase item, not a Phase 0 bug.

## Current Android project

- Capacitor Android project exists.
- `@capacitor/core`, CLI, Android, local notifications, haptics, preferences, splash screen and status bar packages are present.
- Android min SDK is 30, matching the user's Android 11 device.
- Gradle/Android project is configured for Java 21.

## CI limitation

The GitHub connector available for this inspection returned no push-triggered workflow runs or status checks for the current commit, so the exact GitHub Actions failure log could not be independently retrieved.

The frontend build blocker above is nevertheless statically reproducible from the committed source.

## Phase 0 rule

No functional Beacon code has been changed as part of this baseline. Future changes should be small, isolated, and verified after each step.
