# Family Collaboration Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the family workflow with optional assignees, activity history, selective push notifications, status correction, recycle-bin coverage, and project archive/reopen behavior.

**Architecture:** Collaboration metadata remains ordinary synchronized entities. Server-side triggers/functions create durable activity and notification jobs from accepted operations; APNs delivery is asynchronous and never participates in the data transaction. Archived projects are enforced read-only by both RPC validation and UI projections.

**Tech Stack:** Foundation and photo plans plus Supabase Edge Functions, APNs HTTP/2, React Native permissions/native notification integration.

## Global Constraints

- Complete both earlier family collaboration plans first.
- Every member has equal edit rights; assignees are informational workflow ownership, not authorization.
- Ordinary edits create history but no push notification.
- Push failure never rolls back a moving-data operation.
- Archived projects are read-only until any member explicitly reopens them.
- No Git commit may run without explicit user approval.

---

### Task 1: Add optional task and box assignment

**Files:**
- Create: `supabase/migrations/202608130005_assignments.sql`
- Modify: `src/types/moving.ts`
- Modify: `src/repositories/moving-repository.ts`
- Create: `src/components/assignee-picker.tsx`
- Modify: `src/app/boxes.tsx`
- Modify: `src/app/task-timeline.tsx`
- Test: `src/components/assignee-picker.test.tsx`

**Interfaces:**
- Adds nullable `assignee_id` to tasks and boxes.
- Produces filters: `mine | unassigned | all`.

- [ ] Write tests proving any member can assign/unassign, removed members cannot remain selected, and assignment never blocks another member's edit.
- [ ] Add schema constraints and operation payload validation.
- [ ] Implement an accessible picker with “未分配”, “我来负责”, and member names.
- [ ] Add “我的 / 待认领 / 全部” task filters and assignee display on boxes.
- [ ] Run database, component, type, and lint tests; expect PASS.
- [ ] Commit checkpoint with proposed message `feat: add family task assignment` only after approval.

### Task 2: Add durable activity history

**Files:**
- Create: `supabase/migrations/202608130006_activity_events.sql`
- Create: `supabase/tests/activity_events.sql`
- Create: `src/features/activity/activity-repository.ts`
- Create: `src/app/activity.tsx`
- Modify: `src/app/index.tsx`
- Modify: `src/navigation/types.ts`
- Test: `src/features/activity/activity-presentation.test.ts`

**Interfaces:**
- Produces read-only events for member join, create, delete, restore, box status, task completion, photo upload, archive, reopen, and conflict.

- [ ] Write database tests proving one accepted operation creates at most one event and retries create none.
- [ ] Add immutable activity rows and member-only read RLS; clients receive no insert/update/delete grants.
- [ ] Add paginated 30-day query and Chinese presentation mapping such as “妈妈将 BOX-012 标记为已到达”.
- [ ] Add a recent-activity home card and full read-only timeline.
- [ ] Run SQL, presentation, accessibility, and type tests; expect PASS.
- [ ] Commit checkpoint with proposed message `feat: add family activity history` only after approval.

### Task 3: Add explicit box status correction

**Files:**
- Modify: `supabase/migrations/202608130002_sync_protocol.sql` through a new forward migration
- Create: `supabase/migrations/202608130007_status_correction.sql`
- Modify: `src/features/sync/sync-types.ts`
- Modify: `src/features/sync/merge-rules.ts`
- Modify: `src/app/boxes.tsx`
- Test: `src/features/sync/merge-rules.test.ts`

**Interfaces:**
- Adds operation action `correct_status` with payload `{ status: BoxStatus; reason?: string }`.

- [ ] Write tests that ordinary status changes cannot regress, explicit correction can regress, correction increments version, and activity records actor/reason.
- [ ] Implement server validation and merge handling.
- [ ] Put correction behind a secondary “更正状态” action and confirmation sheet; keep the normal next-state action prominent.
- [ ] Run sync, database, and box-screen tests; expect PASS.
- [ ] Commit checkpoint with proposed message `feat: add auditable box status correction` only after approval.

### Task 4: Add selective notification jobs and APNs delivery

**Files:**
- Create: `supabase/migrations/202608130008_notification_jobs.sql`
- Create: `supabase/functions/send-apns-notifications/index.ts`
- Create: `src/features/notifications/device-registration.ts`
- Create: `src/context/notification-context.tsx`
- Modify: `ios/BanjiaTiaoli/AppDelegate.swift`
- Modify: `ios/BanjiaTiaoli/BanjiaTiaoli.entitlements`
- Modify: `ios/BanjiaTiaoli.xcodeproj/project.pbxproj`
- Test: `src/features/notifications/notification-policy.test.ts`

**Interfaces:**
- Produces jobs only for assignment-to-me, moving-day `已搬走`/`已到达`, member join, and `needs_attention` conflict.
- Produces `registerDeviceToken(token, environment)` and `unregisterDeviceToken(token)`.

- [ ] Write policy tests proving ordinary edits, photo uploads, and self-actions generate no job; duplicate events collapse under one dedupe key.
- [ ] Add member-owned device tokens, job table, RLS restrictions, and server-side enqueue trigger/function.
- [ ] Implement native permission request only after explaining value; register APNs token and remove invalid tokens after provider rejection.
- [ ] Implement Edge Function delivery with secrets stored only in Supabase secrets. Mark retryable vs permanent APNs failures and use bounded exponential retry.
- [ ] Run policy tests and a local fake-APNs function test. On two signed devices, verify allow/deny, assignment, critical status, self-suppression, and grouped notifications.
- [ ] Commit checkpoint with proposed message `feat: add focused family notifications` only after approval.

### Task 5: Complete recycle-bin behavior for all entities

**Files:**
- Modify: `src/app/recycle-bin.tsx`
- Modify: `src/repositories/moving-repository.ts`
- Create: `supabase/functions/purge-deleted-entities/index.ts`
- Test: `src/app/recycle-bin.test.tsx`

**Interfaces:**
- Extends recovery to rooms, tasks, boxes, items, and photos.

- [ ] Write tests for remaining-day copy, restore preserving edited content, dependent item behavior when a box is deleted/restored, and purge eligibility after 30 days.
- [ ] Implement grouped recycle-bin projections with deletion actor/time.
- [ ] Ensure deleted boxes do not permanently clear item relationships; normal queries hide both while recovery restores consistent references.
- [ ] Implement service-only purge for rows still deleted after 30 days, with photos purged through the existing photo lifecycle.
- [ ] Run SQL, repository, and UI tests; expect PASS.
- [ ] Commit checkpoint with proposed message `feat: complete recoverable deletion` only after approval.

### Task 6: Add project archive and reopen

**Files:**
- Create: `supabase/migrations/202608130009_project_lifecycle.sql`
- Modify: `src/features/collaboration/bootstrap.ts`
- Modify: `src/context/project-data-context.tsx`
- Modify: `src/app/index.tsx`
- Create: `src/app/project-settings.tsx`
- Test: `src/features/collaboration/project-lifecycle.test.ts`

**Interfaces:**
- Produces RPCs `archive_moving_project(project_id)` and `reopen_moving_project(project_id)`.

- [ ] Write tests that any member may archive/reopen, archived writes are rejected server-side, existing data remains readable, and queued pre-archive writes become `needs_attention` rather than silently applying.
- [ ] Implement lifecycle RPCs and activity events.
- [ ] Disable editing controls from the project read-only projection and provide a clear “重新开启项目” action.
- [ ] Keep one active-project UI; do not build the multi-project switcher in this plan.
- [ ] Run lifecycle, context, navigation, SQL, type, and lint tests; expect PASS.
- [ ] Commit checkpoint with proposed message `feat: add moving project archive lifecycle` only after approval.

### Task 7: Final multi-device, accessibility, and Free-plan verification

**Files:**
- Create: `docs/qa/family-collaboration-release-candidate.md`
- Modify: `README.md`

**Interfaces:**
- Produces the release-candidate evidence required before TestFlight distribution.

- [ ] Run `npx supabase test db`, typecheck, lint, all Jest tests, and unsigned iOS simulator build; record exact output summaries.
- [ ] Execute the three-device matrix: anonymous invite, assignment, simultaneous changes, offline photos, key notifications, correction, delete/restore, archive/reopen, and Apple identity protection.
- [ ] Test VoiceOver labels, dynamic type, focus order, and at least 44×44 pt targets on invitation, assignment, status, retry, restore, and archive controls.
- [ ] Verify non-member data/photo denial and inspect client bundle/config to confirm no service-role, APNs private key, or secret token is present.
- [ ] Record current Supabase Free usage for database size, Storage, egress, Realtime messages/connections, and MAU. Add a release gate if any metric exceeds 70% of its included quota.
- [ ] Update README with setup, environment names, local Supabase tests, Universal Link domain requirements, and Free-to-Pro review gate.
- [ ] Commit checkpoint with proposed message `docs: verify family collaboration release candidate` only after approval.

## Plan Completion Gate

The feature is ready for TestFlight only when every automated check passes, the complete three-device matrix passes, private data is inaccessible to a non-member, notification failures do not affect writes, and Supabase Free usage remains below the documented internal threshold.

