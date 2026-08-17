# Family Collaboration Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build anonymous family projects, invitation links, entity-level offline writes, cursor-based Supabase synchronization, and shared text data for moving rooms, tasks, boxes, and items.

**Architecture:** Keep SQLite as the client source of truth and write every mutation plus its outbox operation in one transaction. Supabase Postgres is the shared source of truth; an idempotent RPC applies operations and emits a monotonic project cursor, while Realtime only wakes the incremental pull loop. React contexts become adapters over focused repositories instead of persisting a whole JSON document.

**Tech Stack:** React Native Community CLI 0.81.5, React 19.1, TypeScript 5.9, Jest 29, OP-SQLite, Supabase JS, PostgreSQL/RLS, React Navigation 7, iOS 15.1+.

## Global Constraints

- Do not add Expo runtime packages or run Expo prebuild.
- Keep native changes in `ios/` and test with `ios/BanjiaTiaoli.xcworkspace`.
- Use a single Supabase Free project for development and TestFlight; a moving project is a database row, not a Supabase project.
- All shared entities use client-generated UUIDs; display box numbers are allocated by the server.
- Realtime is a wake-up signal only; reliable recovery uses cursor-based incremental pulls.
- Normal writes must work offline and never wait for the network to update the UI.
- No Git commit may run without explicit user approval; commit steps below are authorization gates.

---

## File Structure

- `supabase/migrations/`: versioned schema, RPCs, RLS, grants, and database tests.
- `src/config/runtime-config.ts`: validated non-secret Supabase URL and publishable key.
- `src/services/supabase/`: client creation, auth session storage, RPC gateway, and Realtime subscription.
- `src/storage/database/`: SQLite connection, migrations, transaction boundary, and query helpers.
- `src/features/collaboration/`: project/member/invitation domain types and bootstrap use cases.
- `src/features/sync/`: outbox types, merge rules, sync engine, lifecycle coordinator, and status projection.
- `src/repositories/`: local repositories used by contexts and screens.
- `src/context/`: React adapters only; no direct persistence or remote calls after migration.

### Task 1: Add the collaboration runtime and verify native dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `ios/Podfile.lock`
- Create: `.env.example`
- Modify: `.gitignore`
- Create: `src/config/runtime-config.ts`
- Test: `src/config/runtime-config.test.ts`

**Interfaces:**
- Produces: `getRuntimeConfig(env): { supabaseUrl: string; supabasePublishableKey: string; inviteBaseUrl: string }`
- Produces native modules used by later tasks: `@op-engineering/op-sqlite`, `react-native-keychain`, `react-native-config`.

- [ ] **Step 1: Write failing runtime configuration tests**

```ts
import { getRuntimeConfig } from '@/config/runtime-config';

it('rejects a missing publishable key', () => {
  expect(() => getRuntimeConfig({ SUPABASE_URL: 'https://demo.supabase.co' })).toThrow(
    'SUPABASE_PUBLISHABLE_KEY',
  );
});

it('accepts an HTTPS invitation base URL', () => {
  expect(getRuntimeConfig({
    SUPABASE_URL: 'https://demo.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_demo',
    INVITE_BASE_URL: 'https://move.example.com',
  }).inviteBaseUrl).toBe('https://move.example.com');
});
```

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `npm test -- --runInBand src/config/runtime-config.test.ts`  
Expected: FAIL because `runtime-config` does not exist.

- [ ] **Step 3: Install the exact dependency set and CocoaPods**

Run:

```bash
npm install @supabase/supabase-js react-native-url-polyfill @op-engineering/op-sqlite react-native-keychain react-native-config
cd ios && pod install
```

Do not install Expo packages. Record the resolved versions through `package-lock.json` and `Podfile.lock`.

- [ ] **Step 4: Add safe environment handling**

`.env.example` must contain only names and fake values:

```dotenv
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
INVITE_BASE_URL=https://move.example.com
```

Add `.env` to `.gitignore`. Use `react-native-config` as the Community CLI/iOS build bridge, pass its exported object into `getRuntimeConfig`, and keep the validator itself framework-independent for tests. Implement URL parsing, HTTPS enforcement, and an explicit check that the client key begins with `sb_publishable_`. Never accept or expose a secret/service-role key.

- [ ] **Step 5: Run JavaScript and native verification**

Run:

```bash
npm test -- --runInBand src/config/runtime-config.test.ts
npm run typecheck
cd ios && xcodebuild -workspace BanjiaTiaoli.xcworkspace -scheme BanjiaTiaoli -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO
```

Expected: tests, typecheck, and simulator build PASS.

- [ ] **Step 6: Commit checkpoint (requires explicit approval)**

Proposed message: `chore: add collaboration runtime dependencies`

### Task 2: Create the shared Postgres schema and member-only RLS

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202608130001_collaboration_schema.sql`
- Create: `supabase/tests/collaboration_rls.sql`
- Create: `supabase/seed.sql`

**Interfaces:**
- Produces tables: `profiles`, `moving_projects`, `project_members`, `invitations`, `rooms`, `moving_tasks`, `moving_boxes`, `moving_items`, `applied_operations`, `project_changes`.
- Produces helper: `public.is_project_member(target_project_id uuid) returns boolean`.

- [ ] **Step 1: Write pgTAP tests for isolation and membership**

Cover these exact assertions:

```sql
select has_table('public', 'moving_projects');
select has_table('public', 'project_members');
select has_function('public', 'is_project_member', array['uuid']);
select policies_are('public', 'moving_boxes', array[
  'project members can read boxes',
  'project members can insert boxes',
  'project members can update boxes'
]);
```

The test must create two auth users and two projects, set `request.jwt.claim.sub`, and assert that user A cannot select or update project B rows.

- [ ] **Step 2: Run the database test and verify failure**

Run: `npx supabase test db`  
Expected: FAIL because the tables and policies do not exist.

- [ ] **Step 3: Implement schema and constraints**

Use UUID primary keys, `timestamptz`, `version bigint not null default 1`, and `deleted_at timestamptz`. Add:

- unique `(project_id, user_id)` on membership;
- unique `(project_id, display_number)` on non-null box numbers;
- foreign keys scoped to the same project wherever possible;
- checks for box statuses and project states;
- indexes on every `project_id`, `updated_at`, `deleted_at`, and change cursor lookup.

Do not add a member role column.

- [ ] **Step 4: Implement and test RLS**

Enable RLS on every exposed table. Policies must call `is_project_member(project_id)` and use both `using` and `with check`. Do not grant clients direct access to `applied_operations`, raw invitation token hashes, or project cursor allocation internals.

- [ ] **Step 5: Run database and lint verification**

Run:

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --level warning
```

Expected: all pgTAP assertions PASS and no security warnings.

- [ ] **Step 6: Commit checkpoint (requires explicit approval)**

Proposed message: `feat: add collaboration database schema`

### Task 3: Add the idempotent operation RPC and incremental change feed

**Files:**
- Create: `supabase/migrations/202608130002_sync_protocol.sql`
- Create: `supabase/tests/sync_protocol.sql`
- Create: `src/features/sync/sync-types.ts`
- Test: `src/features/sync/sync-types.test.ts`

**Interfaces:**
- Produces RPC: `apply_project_operation(operation_id uuid, project_id uuid, entity_type text, entity_id uuid, action text, base_version bigint, payload jsonb)`.
- Produces RPC: `pull_project_changes(project_id uuid, after_cursor bigint, page_size integer)`.
- Produces TS: `OutboxOperation`, `ApplyOperationResult`, `ProjectChangePage`.

- [ ] **Step 1: Write failing database tests**

Test that:

- the same `operation_id` submitted twice returns the same result;
- duplicate submission creates one entity and one change row;
- two offline boxes receive different `display_number` values;
- `pull_project_changes` returns ordered changes strictly after the supplied cursor;
- a non-member receives a permission error.

- [ ] **Step 2: Run pgTAP and verify failure**

Run: `npx supabase test db`  
Expected: FAIL because both RPCs are missing.

- [ ] **Step 3: Implement the RPC transaction**

`apply_project_operation` must lock/check `applied_operations`, validate membership, apply one entity mutation, increment the entity version, allocate box display numbers under a per-project transaction lock, append one `project_changes` row, record the operation result, and return JSON containing `entity`, `cursor`, and `operationId`.

Supported first-stage actions are exactly: `create`, `update`, `set_status`, `complete`, `soft_delete`, and `restore`.

- [ ] **Step 4: Implement the pull RPC**

Return at most 200 ordered change envelopes and the next cursor. The payload must contain the latest complete row for upserts and `{ id, deletedAt, version }` for deletions. A client must never need Realtime history to recover.

- [ ] **Step 5: Define matching TypeScript discriminated unions**

```ts
export type EntityType =
  | 'room' | 'task' | 'box' | 'item'

export type OperationAction =
  | 'create' | 'update' | 'set_status' | 'complete' | 'soft_delete' | 'restore';

export type OutboxOperation = {
  operationId: string;
  projectId: string;
  entityType: EntityType;
  entityId: string;
  action: OperationAction;
  baseVersion: number;
  payload: Record<string, unknown>;
  createdAt: number;
  attemptCount: number;
};
```

Add decoder tests that reject unknown entity types, actions, or missing cursor values.

- [ ] **Step 6: Run all protocol tests**

Run:

```bash
npx supabase test db
npm test -- --runInBand src/features/sync/sync-types.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit checkpoint (requires explicit approval)**

Proposed message: `feat: add idempotent sync protocol`

### Task 4: Build the SQLite database, migrations, and repositories

**Files:**
- Create: `src/storage/database/connection.ts`
- Create: `src/storage/database/migrations.ts`
- Create: `src/storage/database/schema.ts`
- Create: `src/storage/database/test-database.ts`
- Create: `src/repositories/moving-repository.ts`
- Create: `src/repositories/outbox-repository.ts`
- Create: `src/repositories/sync-state-repository.ts`
- Test: `src/repositories/moving-repository.test.ts`
- Test: `src/repositories/outbox-repository.test.ts`

**Interfaces:**
- Produces: `withDatabaseTransaction<T>(work: (tx: DatabaseTransaction) => Promise<T>): Promise<T>`.
- Produces: `MovingRepository`, `OutboxRepository`, `SyncStateRepository`.
- Consumes domain rows and `OutboxOperation` from Task 3.

- [ ] **Step 1: Write failing repository transaction tests**

```ts
it('persists a box and its outbox operation atomically', async () => {
  await repository.createBox(boxInput, actorId);
  expect(await repository.getBox(boxInput.id)).toMatchObject({ syncStatus: 'pending' });
  expect(await outbox.listReady()).toHaveLength(1);
});

it('rolls back both writes when the outbox insert fails', async () => {
  outbox.failNextInsertForTest();
  await expect(repository.createBox(boxInput, actorId)).rejects.toThrow();
  expect(await repository.getBox(boxInput.id)).toBeNull();
});
```

- [ ] **Step 2: Run tests and confirm missing repositories**

Run: `npm test -- --runInBand src/repositories`  
Expected: FAIL.

- [ ] **Step 3: Implement versioned local schema**

Create normalized tables for projects, members, moving rooms, tasks, boxes, items, outbox, sync state, and a local change-notification table. Store server timestamps as ISO text and local queue times as integer milliseconds. Add indexes matching screen filters and outbox order.

- [ ] **Step 4: Implement repository mutation methods**

Every user mutation must execute entity update and outbox insert in the same SQLite transaction. Repository methods return the locally committed entity and never call Supabase.

- [ ] **Step 5: Implement reactive invalidation boundary**

Expose `subscribeToProject(projectId, listener): () => void`. Notify only after transaction commit. Contexts will re-query projections; they must not receive half-written state.

- [ ] **Step 6: Run repository and type tests**

Run:

```bash
npm test -- --runInBand src/repositories
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit checkpoint (requires explicit approval)**

Proposed message: `feat: add offline collaboration database`

### Task 5: Migrate existing local moving data without destructive writes

**Files:**
- Create: `src/features/collaboration/legacy-import.ts`
- Test: `src/features/collaboration/legacy-import.test.ts`
- Modify: `src/context/moving-context.tsx`

**Interfaces:**
- Produces: `buildLegacyImportPlan(moving: MovingState): LegacyImportPlan`.
- Produces: `executeLegacyImport(plan, repositories): Promise<LegacyImportReceipt>`.

- [ ] **Step 1: Write failing deterministic migration tests**

Test that the importer:

- maps the same legacy ID to the same UUID across retries;
- creates destination rooms before boxes referencing them;
- preserves notes, statuses, moving date, task offsets, and local photo paths;
- does not delete either AsyncStorage key;
- returns the same receipt when rerun after partial completion.

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- --runInBand src/features/collaboration/legacy-import.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement a pure import planner**

Use a deterministic UUID namespace derived from `legacy:<entity-type>:<legacy-id>`. Produce ordered create operations without mutating storage. Photos stay local-only until the second implementation plan.

- [ ] **Step 4: Implement transactional local import and receipt**

Record an import receipt keyed by source storage version. If any local transaction fails, keep the old contexts active and surface a retry state. Do not remove the old storage keys in this release.

- [ ] **Step 5: Run migration and regression tests**

Run:

```bash
npm test -- --runInBand src/features/collaboration/legacy-import.test.ts src/logic/moving.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit checkpoint (requires explicit approval)**

Proposed message: `feat: migrate local moving data safely`

### Task 6: Add secure anonymous bootstrap and project creation

**Files:**
- Create: `src/services/supabase/keychain-auth-storage.ts`
- Create: `src/services/supabase/client.ts`
- Create: `src/features/collaboration/bootstrap.ts`
- Create: `src/context/session-context.tsx`
- Create: `src/app/collaboration-onboarding.tsx`
- Modify: `src/navigation/types.ts`
- Modify: `App.tsx`
- Test: `src/features/collaboration/bootstrap.test.ts`

**Interfaces:**
- Produces: `ensureAnonymousSession(): Promise<AuthIdentity>`.
- Produces: `createMovingProject(input): Promise<{ projectId: string }>`.
- Produces `SessionContextValue` with `status`, `identity`, `currentProjectId`, and `retry`.

- [ ] **Step 1: Write failing bootstrap state-machine tests**

Cover: restored session, fresh anonymous session, offline with cached project, offline with no identity, project creation retry, and legacy import failure.

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- --runInBand src/features/collaboration/bootstrap.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement Keychain-backed Supabase storage**

Implement the Supabase storage adapter methods `getItem`, `setItem`, and `removeItem` using a service name scoped to the bundle ID. Configure `autoRefreshToken: true`, `persistSession: true`, and `detectSessionInUrl: false`; start/stop token refresh from React Native `AppState` following Supabase's React Native guidance.

- [ ] **Step 4: Implement onboarding and bootstrap orchestration**

The screen asks only for a display name and project name. On submit: ensure anonymous session, upsert profile, create project plus membership in one RPC, execute legacy import if accepted, then start the first sync. Offline users with an existing local project enter it; fresh users see a clear “首次创建需要联网” state.

- [ ] **Step 5: Verify auth and navigation**

Run:

```bash
npm test -- --runInBand src/features/collaboration/bootstrap.test.ts
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit checkpoint (requires explicit approval)**

Proposed message: `feat: add anonymous collaboration onboarding`

### Task 7: Implement merge rules and the sync engine

**Files:**
- Create: `src/features/sync/merge-rules.ts`
- Create: `src/features/sync/sync-gateway.ts`
- Create: `src/features/sync/sync-engine.ts`
- Test: `src/features/sync/merge-rules.test.ts`
- Test: `src/features/sync/sync-engine.test.ts`

**Interfaces:**
- Produces: `mergeRemoteChange(local, remote): MergeDecision`.
- Produces: `SyncEngine.flush(projectId): Promise<SyncSummary>`.
- Produces: `SyncEngine.pull(projectId): Promise<SyncSummary>`.
- Consumes repositories from Task 4 and RPCs from Task 3.

- [ ] **Step 1: Write failing merge tests**

Include exact cases:

- higher box status wins over a later stale lower status;
- last accepted scalar update replaces name/note/assignee;
- remote soft delete keeps locally edited content for later restore;
- unrelated entity changes both survive.

- [ ] **Step 2: Write failing engine tests with a fake gateway**

Verify FIFO submission, idempotent retry, exponential backoff metadata, submission before pull, 200-row pagination, cursor persistence only after local transaction commit, and isolation of one failed photo-free operation from later independent entities.

- [ ] **Step 3: Run tests and verify failure**

Run: `npm test -- --runInBand src/features/sync`  
Expected: FAIL.

- [ ] **Step 4: Implement pure merge rules**

Represent decisions as `acceptRemote`, `keepLocalPending`, or `needsAttention`. Do not compare client wall clocks for authoritative ordering; use server version/cursor and the box status ordering.

- [ ] **Step 5: Implement flush and pull loops**

Limit one active sync per project with a mutex. Retry network/5xx failures, stop retrying RLS/validation failures, and persist structured failure codes. A crashed process must leave the operation in the outbox.

- [ ] **Step 6: Run focused and complete unit tests**

Run:

```bash
npm test -- --runInBand src/features/sync
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit checkpoint (requires explicit approval)**

Proposed message: `feat: add offline sync engine`

### Task 8: Migrate MovingContext to repository-backed shared data

**Files:**
- Create: `src/context/project-data-context.tsx`
- Modify: `src/context/moving-context.tsx`
- Modify: `src/types/moving.ts`
- Modify: `src/app/index.tsx`
- Modify: `src/app/boxes.tsx`
- Modify: `src/app/items.tsx`
- Modify: `src/app/task-timeline.tsx`
- Modify: `src/components/room-manager.tsx`
- Test: `src/context/project-data-context.test.tsx`

**Interfaces:**
- Keeps the existing `useMoving()` consumer signature wherever behavior is unchanged.
- Adds `syncStatus`, `updatedBy`, `version`, `deletedAt`, and nullable server `code` to shared models.
- Consumes `MovingRepository` and project subscription from Task 4.

- [ ] **Step 1: Write failing provider adapter tests**

Test that repository changes re-render consumers, local writes appear before gateway resolution, failed sync keeps visible data, and deleted rows disappear from normal projections.

- [ ] **Step 2: Run the provider tests and verify failure**

Run: `npm test -- --runInBand src/context/project-data-context.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Split persistence from the existing context**

Move mutation implementation into repositories. `MovingContext` computes existing lookups and preserves screen-facing methods, but must not call `AsyncStorage.setItem` or Supabase directly. (The memory homes feature was removed from the product on 2026-08-15; `MemoryContext` no longer exists.) Photo binaries and photo metadata remain local until the photo plan.

- [ ] **Step 4: Adapt temporary box numbering**

Render `box.code ?? '待编号'`. Search and sorting must use UUID plus optional display number without assuming every local box already has a code.

- [ ] **Step 5: Run all existing presentation and logic tests**

Run:

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
```

Expected: PASS with no regression in current single-user flows.

- [ ] **Step 6: Commit checkpoint (requires explicit approval)**

Proposed message: `refactor: back moving context with local database`

### Task 9: Add invitation RPCs, member joining, and Universal Links

**Files:**
- Create: `supabase/migrations/202608130003_invitations.sql`
- Create: `supabase/tests/invitations.sql`
- Create: `src/features/collaboration/invite-links.ts`
- Create: `src/features/collaboration/invitation-gateway.ts`
- Create: `src/app/join-project.tsx`
- Modify: `src/navigation/types.ts`
- Modify: `App.tsx`
- Modify: `ios/BanjiaTiaoli/AppDelegate.swift`
- Create: `ios/BanjiaTiaoli/BanjiaTiaoli.entitlements`
- Modify: `ios/BanjiaTiaoli.xcodeproj/project.pbxproj`
- Create: `public/.well-known/apple-app-site-association`
- Create: `public/invite/index.html`
- Test: `src/features/collaboration/invite-links.test.ts`

**Interfaces:**
- Produces RPCs: `create_project_invitation`, `revoke_project_invitation`, `accept_project_invitation`.
- Produces: `parseInvitationUrl(url): { token: string } | null`.

- [ ] **Step 1: Write invitation security tests**

Test 7-day expiry, hash-only token storage, revocation, duplicate acceptance, expired rejection, non-member creation rejection, and archived-project rejection.

- [ ] **Step 2: Write URL parser tests**

Accept only exact HTTPS host and `/invite/<base64url-token>` path. Reject custom schemes, wrong hosts, empty tokens, query-string tokens, and fragments.

- [ ] **Step 3: Implement invitation RPCs**

Generate at least 256 bits of random token material server-side, store only SHA-256 hash, return plaintext once, and create membership under a transaction in `accept_project_invitation`.

- [ ] **Step 4: Implement cold and warm link handling**

Use `Linking.getInitialURL()` and `Linking.addEventListener('url', ...)`. Forward iOS universal-link callbacks through `RCTLinkingManager` in `AppDelegate.swift`. Configure the Associated Domains entitlement with `applinks:<configured-host>` and serve an AASA file restricted to `/invite/*`. The static fallback page must preserve the invitation URL, explain that the App is required, and expose the configured App Store link once one exists; before an App Store ID exists, show TestFlight installation instructions from configuration rather than a broken store link.

- [ ] **Step 5: Implement join screen states**

Show project preview only after server validation. Require display name if missing. Handle `expired`, `revoked`, `already_member`, `archived`, `offline`, and generic retry states with distinct copy.

- [ ] **Step 6: Verify SQL, JS, and iOS build**

Run:

```bash
npx supabase test db
npm test -- --runInBand src/features/collaboration
npm run typecheck
cd ios && xcodebuild -workspace BanjiaTiaoli.xcworkspace -scheme BanjiaTiaoli -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO
```

Expected: PASS. Then test one cold-start and one foreground Universal Link on a signed device/build because simulator build alone cannot prove domain association.

- [ ] **Step 7: Commit checkpoint (requires explicit approval)**

Proposed message: `feat: add family invitation links`

### Task 10: Add Realtime wakeups, lifecycle sync, and visible failure states

**Files:**
- Create: `src/services/supabase/realtime-project-channel.ts`
- Create: `src/features/sync/sync-coordinator.ts`
- Create: `src/context/sync-context.tsx`
- Create: `src/components/sync-banner.tsx`
- Modify: `src/app/index.tsx`
- Modify: `App.tsx`
- Test: `src/features/sync/sync-coordinator.test.ts`
- Test: `src/components/sync-banner.test.tsx`

**Interfaces:**
- Produces: `SyncCoordinator.start(projectId): () => void`.
- Produces: `useSyncStatus(): { pending: number; failed: number; needsAttention: number; retry(): void }`.

- [ ] **Step 1: Write failing lifecycle tests**

Verify sync on startup, foreground, network recovery, Realtime event, and manual retry. Verify event coalescing and that only one project channel is active.

- [ ] **Step 2: Implement the coordinator**

Start with `flush → pull`, subscribe to a private project channel, debounce wakeups, and always perform a cursor pull after reconnect. Unsubscribe on project change or provider unmount.

- [ ] **Step 3: Implement failure-only UI**

Render nothing when fully synchronized. Render “N 项待同步” for pending work, “同步失败，点按重试” for retryable failures, and a separate count for `needs_attention`. Add accessibility roles and labels.

- [ ] **Step 4: Run automated verification**

Run:

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Run the three-device acceptance matrix**

Use three isolated simulator/app data sets or two simulators plus one device. Verify: join, offline create, simultaneous box create, stale status submission, force-kill with queued operation, reconnect catch-up, and unauthorized project access. Save results to `docs/qa/family-collaboration-foundation.md` with date, devices, build, and PASS/FAIL per scenario.

- [ ] **Step 6: Commit checkpoint (requires explicit approval)**

Proposed message: `feat: complete shared moving sync foundation`

## Plan Completion Gate

Before starting the photo plan, all commands below must pass and the three-device matrix must contain no unresolved severity-1 or severity-2 failures:

```bash
npx supabase test db
npm run typecheck
npm run lint
npm test -- --runInBand
cd ios && xcodebuild -workspace BanjiaTiaoli.xcworkspace -scheme BanjiaTiaoli -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO
```
