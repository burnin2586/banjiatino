# Family Photo Sync and Identity Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize private moving and room photos offline-first, then let anonymous family members protect the same account with Sign in with Apple.

**Architecture:** Photo metadata participates in the same SQLite outbox/cursor protocol, while binary files use a separate resumable queue and private Supabase Storage paths. Clients create thumbnails and compressed shared images locally, upload them independently, and apply metadata only after object confirmation. Native Apple identity is linked to the existing anonymous Supabase user so membership IDs never change.

**Tech Stack:** Foundation plan stack plus `react-native-image-resizer`, Supabase Storage, Apple AuthenticationServices, private Storage RLS, iOS Keychain.

## Global Constraints

- Complete `2026-08-13-family-collaboration-foundation.md` first.
- Do not upload camera originals by default.
- Photo failure must never block task, box, item, or room text synchronization.
- Storage objects are private and accessible only to active project members.
- Device-side thumbnails and shared images avoid paid cloud image transformations.
- No Git commit may run without explicit user approval.

---

### Task 1: Add photo metadata schema and private Storage policies

**Files:**
- Create: `supabase/migrations/202608130004_photos.sql`
- Create: `supabase/tests/photo_storage_rls.sql`
- Modify: `src/features/sync/sync-types.ts`

**Interfaces:**
- Produces `photos` rows with `local_id`, `project_id`, `owner_entity_type`, `owner_entity_id`, `thumbnail_path`, `shared_path`, `caption`, versions, audit fields, and `deleted_at`.
- Extends `EntityType` with `photo`.

- [ ] Write pgTAP tests proving members can read/write project paths and non-members cannot.
- [ ] Run `npx supabase test db` and confirm failure.
- [ ] Add the table, owner constraints, indexes, RLS, and private `moving-photos` bucket policies. Paths must be `<project-id>/<photo-id>/thumbnail.jpg` and `<project-id>/<photo-id>/shared.jpg`.
- [ ] Extend `apply_project_operation` and `pull_project_changes` for photo metadata without accepting arbitrary storage paths.
- [ ] Run `npx supabase db reset && npx supabase test db && npx supabase db lint --level warning`; expect PASS.
- [ ] Commit checkpoint with proposed message `feat: add private shared photo schema` only after approval.

### Task 2: Build deterministic on-device photo derivatives

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `ios/Podfile.lock`
- Create: `src/features/photos/photo-processor.ts`
- Test: `src/features/photos/photo-processor.test.ts`

**Interfaces:**
- Produces: `prepareSharedPhoto(sourceUri, photoId): Promise<{ localOriginalUri; thumbnailUri; sharedUri; width; height; byteSize }>`.

- [ ] Write tests using a fake native resizer: longest thumbnail edge 320 px, longest shared edge 2048 px, JPEG quality 0.78, orientation preserved, and output stored under the photo UUID.
- [ ] Run the test and confirm failure.
- [ ] Install `react-native-image-resizer`, run `cd ios && pod install`, and implement an injected processor so unit tests do not invoke native code.
- [ ] Reject unreadable files and inputs above the configured safety limit before queue insertion; clean partial derivative files on failure.
- [ ] Run photo tests, typecheck, and an unsigned simulator build; expect PASS.
- [ ] Commit checkpoint with proposed message `feat: prepare shared photo derivatives` only after approval.

### Task 3: Add the binary upload queue

**Files:**
- Modify: `src/storage/database/migrations.ts`
- Create: `src/features/photos/photo-upload-repository.ts`
- Create: `src/features/photos/photo-upload-engine.ts`
- Create: `src/services/supabase/photo-storage-gateway.ts`
- Test: `src/features/photos/photo-upload-engine.test.ts`

**Interfaces:**
- Produces: `PhotoUploadEngine.flush(projectId): Promise<UploadSummary>`.
- Produces upload states `local | queued | uploading_thumbnail | uploading_shared | confirming | uploaded | failed`.

- [ ] Write failing tests for offline enqueue, thumbnail-first upload, retry after process restart, idempotent object overwrite, cancellation after soft delete, and text-sync independence.
- [ ] Add a SQLite `photo_uploads` table keyed by photo ID with attempts and next-attempt time.
- [ ] Implement upload with member-authenticated Storage calls and explicit content type/cache control. Confirm both objects before enqueuing the photo metadata `create` operation.
- [ ] On partial success, retry only the missing object. Never delete the local original automatically.
- [ ] Run `npm test -- --runInBand src/features/photos` and typecheck; expect PASS.
- [ ] Commit checkpoint with proposed message `feat: add resilient photo upload queue` only after approval.

### Task 4: Integrate photos into the moving context

**Files:**
- Modify: `src/context/moving-context.tsx`
- Modify: `src/logic/photo-store.ts`
- Modify: `src/app/boxes.tsx`
- Create: `src/components/shared-photo.tsx`
- Test: `src/components/shared-photo.test.tsx`

**Interfaces:**
- Produces `SharedPhoto` that prefers local derivative, then cached thumbnail, then signed remote URL.
- Consumes upload states from Task 3.

- [ ] Write tests for immediate local display, queued badge, failed retry, remote thumbnail fallback, and deleted photo removal.
- [ ] Replace direct local-only metadata writes with repository plus upload-queue transactions while retaining local originals.
- [ ] Add signed URL refresh and disk cache keyed by object version; do not persist expiring signed URLs as entity data.
- [ ] Render per-photo failure without changing associated box/room sync status.
- [ ] Run all box, photo, type, and lint tests; expect PASS.
- [ ] Commit checkpoint with proposed message `feat: sync family moving photos` only after approval.

### Task 5: Add delayed Storage cleanup and photo recovery

**Files:**
- Create: `supabase/functions/purge-deleted-photos/index.ts`
- Create: `supabase/tests/photo_recovery.sql`
- Create: `src/app/recycle-bin.tsx`
- Modify: `src/navigation/types.ts`

**Interfaces:**
- Produces purge function that deletes objects only when `deleted_at < now() - interval '30 days'` and the row is still deleted.

- [ ] Write database tests proving restore within 30 days keeps objects and purge ignores active rows.
- [ ] Implement soft delete/restore UI with deletion actor, time, and remaining retention.
- [ ] Implement scheduled purge using service-role credentials only inside the Edge Function; never ship them to the client.
- [ ] Run database tests and a local function invocation against seeded deleted/active photos; expect only expired deleted objects selected.
- [ ] Commit checkpoint with proposed message `feat: add photo recovery lifecycle` only after approval.

### Task 6: Link anonymous users to Sign in with Apple

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `ios/Podfile.lock`
- Modify: `ios/BanjiaTiaoli/BanjiaTiaoli.entitlements`
- Modify: `ios/BanjiaTiaoli.xcodeproj/project.pbxproj`
- Create: `src/features/identity/apple-identity.ts`
- Create: `src/app/protect-account.tsx`
- Modify: `src/context/session-context.tsx`
- Test: `src/features/identity/apple-identity.test.ts`

**Interfaces:**
- Produces: `protectAnonymousAccountWithApple(): Promise<'linked' | 'cancelled' | 'merge_required'>`.

- [ ] Write tests for successful link retaining user ID, user cancellation, missing identity token, nonce mismatch, and an Apple identity already linked elsewhere.
- [ ] Install a maintained native Sign in with Apple library compatible with RN 0.81, run CocoaPods, and enable the Sign in with Apple entitlement/capability.
- [ ] Generate and hash a cryptographic nonce, request the native Apple credential, and call Supabase identity linking with the returned ID token. Verify the Supabase user ID before and after linking is identical.
- [ ] For `identity_already_exists`, stop and display a merge-required screen. Do not sign out or move project memberships automatically.
- [ ] Run tests, typecheck, lint, and an iOS build. On a signed physical device, verify success, cancel, and repeat-login flows.
- [ ] Commit checkpoint with proposed message `feat: protect anonymous accounts with Apple` only after approval.

### Task 7: Add the protection prompt and complete photo/identity QA

**Files:**
- Create: `src/features/identity/protection-prompt.ts`
- Modify: `src/app/index.tsx`
- Modify: `src/app/boxes.tsx`
- Create: `docs/qa/family-photo-identity.md`
- Test: `src/features/identity/protection-prompt.test.ts`

**Interfaces:**
- Produces: `shouldOfferAccountProtection({ isAnonymous, successfulUploads, dismissedAt, now }): boolean`.

- [ ] Write tests: prompt after first successful upload, never for permanent users, dismissal suppresses for 7 days, and settings entry remains available.
- [ ] Implement a non-blocking prompt with “使用 Apple 登录保护记录” and “稍后”。
- [ ] Run all automated checks from the foundation plan.
- [ ] Execute two-device offline photo QA: create offline, force-kill, reconnect, thumbnail visibility, shared image load, soft delete, restore, non-member denial, and Apple link identity preservation.
- [ ] Record exact devices/build/results in `docs/qa/family-photo-identity.md`.
- [ ] Commit checkpoint with proposed message `feat: complete photo sync and identity protection` only after approval.

## Plan Completion Gate

Do not start collaboration polish until all automated checks pass, private-photo access is verified with a non-member account, queued uploads survive force-kill, and Apple linking preserves the original Supabase user ID on a signed device.

