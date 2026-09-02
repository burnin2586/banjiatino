# Refined Blue-White Full App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved refined blue-and-white tactile design and concise Chinese copy to every existing Banjiatino app screen.

**Architecture:** Preserve the React Navigation routes, context APIs, persistence, and business behavior. Extend the existing theme and shared UI kit, then compose the eight approved screens from those primitives. Add one established icon package for consistent line icons and keep screen-specific presentation inside each existing screen.

**Tech Stack:** React Native 0.81.5, React 19.1, TypeScript 5.9, React Navigation 7, Jest 29, `react-native-svg`, Lucide React Native

**Spec:** `.superdesign/design-system.md`

## Global Constraints

- React Native Community CLI only; do not add Expo or run Expo prebuild.
- Keep the four bottom destinations: `进度`, `物品`, `箱子`, `查找`.
- Use only the approved blue-white palette; yellow is limited to one small warning or milestone per screen.
- Use system fonts, 20pt page margins, 44pt minimum touch targets, and no gradients, emoji, or character glyph icons.
- Page titles and actions must be direct; remove slogans, role-play language, and redundant descriptions.
- Preserve all data models, persistence, collaboration, sync, camera, photo, task, and room-management behavior.
- Do not commit, tag, push, or create a PR without explicit user authorization.

---

### Task 1: Lock the shared visual contract

**Files:**
- Modify: `src/constants/app-theme.test.ts`
- Modify: `src/constants/app-theme.ts`
- Modify: `src/components/ui-kit-style.test.ts`
- Modify: `src/components/ui-kit.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: existing `AppColors`, `AppRadius`, `AppShadow`, and UI-kit APIs.
- Produces: `surfaceMuted: '#EAF4FF'`, restrained raised shadow, line-icon-capable shared components, grouped surface/list primitives, and unchanged public component signatures.

- [ ] Write failing tests asserting the approved secondary surface, restrained raised shadow opacity, icon-only button accessibility, and shared selected-state behavior.
- [ ] Run `npm test -- src/constants/app-theme.test.ts src/components/ui-kit-style.test.ts --runInBand`; confirm failures are caused by the old values or missing behavior.
- [ ] Install `lucide-react-native` and update the shared theme/UI primitives with the minimal implementation required by the tests.
- [ ] Re-run the focused tests and `npm run typecheck`; expect both to pass.

### Task 2: Refine navigation and the progress screen

**Files:**
- Modify: `src/navigation/tab-presentation.test.ts`
- Modify: `src/navigation/tab-presentation.ts`
- Modify: `App.tsx`
- Modify: `src/app/index.tsx`
- Modify: `src/components/invite-family-card.tsx`
- Modify: `src/components/sync-banner-presentation.ts`
- Modify: `src/components/sync-banner.test.ts`

**Interfaces:**
- Consumes: current routes, home summary calculations, task navigation, sync state, and invite behavior.
- Produces: Lucide tab icons and the approved `搬家进度` hierarchy with date/task first, one progress console, concise exception copy, grouped room rows, and grouped recent boxes.

- [ ] Write failing presentation tests for the new concise sync labels and icon names while preserving route order.
- [ ] Run the focused tests and confirm RED.
- [ ] Replace character tab glyphs with icon identifiers and update Home/invite/sync copy and layout without changing any actions or calculations.
- [ ] Run focused tests, `npm run typecheck`, and `npm run lint`; expect success.

### Task 3: Refine items, boxes, and search

**Files:**
- Modify: `src/app/items.tsx`
- Modify: `src/app/boxes.tsx`
- Modify: `src/app/search.tsx`
- Modify: `src/components/template-picker.tsx`
- Modify: `src/components/room-manager.tsx`

**Interfaces:**
- Consumes: existing CRUD handlers, status setters, templates, search matching, camera/library flows, and room manager.
- Produces: direct page titles (`物品清单`, `箱子`, `查找物品`), compact empty/error copy, consistent search/input styling, and lighter grouped lists.

- [ ] Preserve existing presentation/logic tests as the behavior contract and run them before editing.
- [ ] Apply the approved copy map and remove every slogan, emoji, character icon, and redundant explanation.
- [ ] Consolidate repeated row surfaces where possible without changing list order, status transitions, form fields, or alerts' destructive semantics.
- [ ] Run all related tests, typecheck, and lint; expect success.

### Task 4: Refine tasks, photos, and collaboration

**Files:**
- Modify: `src/app/task-timeline.tsx`
- Modify: `src/app/storage/[photoId].tsx`
- Modify: `src/components/storage/photo-marker-canvas.tsx`
- Modify: `src/app/collaboration-onboarding.tsx`
- Modify: `src/app/join-project.tsx`
- Modify: `src/features/collaboration/invitation-copy.ts`

**Interfaces:**
- Consumes: existing task CRUD, date wheel, photo marker/editor, onboarding/session, and invitation flow.
- Produces: approved direct titles (`搬家任务`, `收纳照片`, `创建或加入搬家项目`, `加入搬家项目`) and short, actionable form/error copy.

- [ ] Run task and collaboration suites before editing to establish the behavior baseline.
- [ ] Apply the approved screen structures and copy while retaining every current state transition and destructive confirmation.
- [ ] Remove character arrows/emoji and use Lucide icons only for navigation and action recognition.
- [ ] Run task/collaboration tests, typecheck, and lint; expect success.

### Task 5: Full verification and visual QA

**Files:**
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: the eight approved Superdesign drafts and the completed iOS app.
- Produces: a verified build and a Product Design QA report with `final result: passed`, or an explicit blocked report if simulator capture is unavailable.

- [ ] Run `npm test -- --runInBand`, `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [ ] Build and launch `ios/BanjiaTiaoli.xcworkspace` on an iOS Simulator.
- [ ] Capture representative states for all eight screens and compare them with their corresponding Superdesign targets at the same viewport/state.
- [ ] Fix all P0/P1/P2 differences, repeat the checks, and update `design-qa.md` with the final result.
- [ ] Report modified files, verification commands/results, remaining P3 polish, risks, and rollback instructions; do not commit.
