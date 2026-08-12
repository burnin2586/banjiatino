# Banjiatino Blue Toy React Native Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Banjiatino brand v4 and Collector Toy UI across the shared React Native shell, Home, Boxes, and Memories screens, then verify the bare iOS app in Xcode without introducing Expo.

**Architecture:** Keep the existing React Navigation, contexts, data models, persistence, and screen behavior. Replace the old green/beige visual foundation with one centralized blue-toy theme, upgrade existing UI primitives, and make each approved screen a thin composition of those primitives. Brand assets live in the versioned Xcode asset catalog; visual correctness is verified on an iOS Simulator against the approved Superdesign drafts.

**Tech Stack:** React Native 0.81.5, React 19.1, TypeScript 5.9, React Navigation 7, Jest 29, iOS/Xcode asset catalogs and storyboards

## Global Constraints

- The selected chain is: brand v4 → Home A / Collector v3 → Boxes v3 → Memories v3.
- Main palette: `#176BDB`, `#2F80ED`, `#BFDFFF`, `#F3F9FF`, `#FFFFFF`.
- Yellow: `#FFC928` / `#FFF3BD`, used only for one compact current cue per screen and below 10% visible area.
- Ink and line: `#17243A`, `#53657D`, `#D8E8F7`; semantic delete red is `#A12F2F`.
- System fonts only; no font packages or custom font files.
- Materials are shallow white ceramic, blue plastic, and inset blue rails with a unified top-left light and short soft shadows.
- Minimum interactive target is `44×44pt`; Dynamic Type must wrap rather than truncate key content.
- Preserve current navigation, context APIs, persistence keys, data models, data values, permissions, and interactions.
- Do not add Expo packages, run Expo prebuild, or replace the versioned native Xcode project.
- Do not add a new icon dependency; retain the approved five existing tab glyphs.
- Do not commit, stage, push, or create a PR unless the user explicitly authorizes it.

---

### Task 1: Establish the blue-toy theme contract

**Files:**
- Modify: `src/constants/app-theme.ts`
- Create: `src/constants/app-theme.test.ts`

**Interfaces:**
- Consumes: approved design tokens and the existing `AppColors`, `AppSpacing`, and `AppRadius` imports.
- Produces: backward-compatible `AppColors`, plus `AppShadow`, `AppTypography`, and `AppMotion` constants for all later tasks.

- [ ] **Step 1: Write the failing token-contract tests**

```ts
import { AppColors, AppMotion, AppRadius, AppShadow } from './app-theme';

test('uses the approved Banjiatino palette', () => {
  expect(AppColors).toMatchObject({
    primary: '#176BDB',
    primaryBright: '#2F80ED',
    primarySoft: '#BFDFFF',
    background: '#F3F9FF',
    surface: '#FFFFFF',
    accent: '#FFC928',
    accentSoft: '#FFF3BD',
    text: '#17243A',
    textMuted: '#53657D',
    border: '#D8E8F7',
    danger: '#A12F2F',
  });
});

test('defines continuous radii, soft shadows, and restrained motion', () => {
  expect(AppRadius).toMatchObject({ page: 24, card: 18, control: 14, label: 10 });
  expect(AppShadow.ceramic.shadowColor).toBe('#176BDB');
  expect(AppShadow.ceramic.shadowRadius).toBeGreaterThan(0);
  expect(AppMotion.press).toBeGreaterThanOrEqual(100);
  expect(AppMotion.press).toBeLessThanOrEqual(140);
});
```

- [ ] **Step 2: Run the test and verify the contract fails for the old green theme**

Run: `npm test -- src/constants/app-theme.test.ts --runInBand`

Expected: FAIL because the approved tokens and new exports do not exist yet.

- [ ] **Step 3: Implement the backward-compatible theme**

Keep every existing property name used by the app, mapping it into the approved system:

```ts
export const AppColors = {
  background: '#F3F9FF',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F9FF',
  primary: '#176BDB',
  primaryBright: '#2F80ED',
  primarySoft: '#BFDFFF',
  accent: '#FFC928',
  accentSoft: '#FFF3BD',
  text: '#17243A',
  textMuted: '#53657D',
  border: '#D8E8F7',
  success: '#176BDB',
  warning: '#17243A',
  danger: '#A12F2F',
  white: '#FFFFFF',
} as const;

export const AppShadow = {
  ceramic: {
    shadowColor: '#176BDB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  raised: {
    shadowColor: '#176BDB', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
} as const;
```

Add `page/card/control/label` radius aliases while retaining `sm/md/lg/pill`. Add system font weights/sizes only; do not set `fontFamily`.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- src/constants/app-theme.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Run typecheck before moving to shared components**

Run: `npm run typecheck`

Expected: exit `0` with all existing imports still valid.

---

### Task 2: Upgrade shared Collector Toy primitives

**Files:**
- Modify: `src/components/ui-kit.tsx`
- Create: `src/components/ui-kit-style.test.ts`

**Interfaces:**
- Consumes: `AppColors`, `AppRadius`, `AppShadow`, `AppSpacing` from Task 1.
- Produces: existing component APIs plus exported pure `getChoiceChipPalette(selected, milestone)` and `getPressDepth(pressed)` style helpers.

- [ ] **Step 1: Write failing tests for shared visual-state helpers**

```ts
import { getChoiceChipPalette, getPressDepth } from './ui-kit';

test('uses yellow only for an explicit milestone chip', () => {
  expect(getChoiceChipPalette(true, true)).toEqual({ background: '#FFC928', text: '#17243A' });
  expect(getChoiceChipPalette(true, false)).toEqual({ background: '#176BDB', text: '#FFFFFF' });
});

test('moves a pressed plastic control down two points', () => {
  expect(getPressDepth(false)).toEqual([{ translateY: 0 }]);
  expect(getPressDepth(true)).toEqual([{ translateY: 2 }]);
});
```

- [ ] **Step 2: Run the test and verify it fails because the helpers do not exist**

Run: `npm test -- src/components/ui-kit-style.test.ts --runInBand`

Expected: FAIL on missing exports.

- [ ] **Step 3: Implement the shared helpers and preserve component signatures**

Add an optional `milestone = false` prop to `ChoiceChip`; keep all current callers valid. Apply these rules:

- `Screen`: ice-blue background, 20pt horizontal inset, 24pt vertical section gap, existing bottom-nav clearance.
- `PageHeader`: system type, 32pt title, wrapping text column, action with `flexShrink: 0`.
- `Card`: 18pt continuous radius, 1–1.5pt line-blue border, `AppShadow.ceramic`.
- `PrimaryButton` / `AddButton`: blue plastic, top white highlight represented by border/highlight view, `minHeight: 44`, pressed `translateY: 2`.
- `TextButton`, `ChoiceChip`, modal close: at least 44pt effective target.
- `StatusBadge`: blue/white default; warning never uses low-contrast yellow text.
- `EmptyState`: keep current API and allow large wrapping Dynamic Type.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- src/components/ui-kit-style.test.ts --runInBand && npm run typecheck`

Expected: both commands pass.

- [ ] **Step 5: Run existing logic tests to catch accidental behavior changes**

Run: `npm test -- --runInBand`

Expected: all existing suites plus the two new suites pass.

---

### Task 3: Implement the blue physical five-tab navigation

**Files:**
- Create: `src/navigation/tab-presentation.ts`
- Create: `src/navigation/tab-presentation.test.ts`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: existing `MainTabParamList`, glyphs, labels, and Task 1 tokens.
- Produces: `getTabPresentation(routeName)` and a white rounded navigation base with a raised blue selected item.

- [ ] **Step 1: Write the failing exact-order test**

```ts
import { tabOrder, getTabPresentation } from './tab-presentation';

test('keeps the approved five destinations and labels', () => {
  expect(tabOrder).toEqual(['Home', 'Items', 'Boxes', 'Search', 'Memory']);
  expect(tabOrder.map((route) => getTabPresentation(route).label))
    .toEqual(['进度', '物品', '箱子', '查找', '回忆']);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test -- src/navigation/tab-presentation.test.ts --runInBand`

Expected: FAIL because the presentation module does not exist.

- [ ] **Step 3: Extract the label/glyph contract and restyle React Navigation**

Implement `getTabPresentation` with the approved glyphs `⌂ / ◇ / □ / ⌕ / ◉`. In `App.tsx` configure:

- white 82pt tab base with 24pt continuous top corners and line-blue border;
- `tabBarActiveBackgroundColor: AppColors.primary` and active tint white;
- inactive tint `AppColors.textMuted`;
- 14pt rounded tab items with at least 44pt internal height;
- blue-tinted short shadow, never a black default shadow;
- preserve all existing routes, providers, stack behavior, and `headerShown: false`.

- [ ] **Step 4: Run the navigation test and typecheck**

Run: `npm test -- src/navigation/tab-presentation.test.ts --runInBand && npm run typecheck`

Expected: PASS.

---

### Task 4: Implement the approved Collector Home screen

**Files:**
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: existing `useMoving()` state/lookup APIs and upgraded UI primitives.
- Produces: the approved Home composition without changing summary calculations or actions.

- [ ] **Step 1: Add a failing presentation assertion to the existing moving tests**

Extract a pure `getHomeMilestone(unboxed: number)` helper from `index.tsx` or a nearby presentation module and test:

```ts
test('shows the single warning milestone only when items are unboxed', () => {
  expect(getHomeMilestone(1)).toBe('unboxed-warning');
  expect(getHomeMilestone(0)).toBeNull();
});
```

Run: `npm test -- src/app/index.test.ts --runInBand`

Expected: FAIL because the helper/test file does not exist.

- [ ] **Step 2: Implement the Home visuals with existing data and controls**

Keep the exact render order and copy. Apply:

- demo card: shallow ceramic panel and blue compact CTA;
- hero: 24pt blue plastic console, 56pt percentage, circular `arrived/total`, inset 20pt progress rail, and dark-blue translucent metric tray;
- warning: white ceramic card with the screen's only yellow 44pt marker;
- rooms: airy 2×2 ceramic modules; preserve user room colors only as a narrow data accent, not a broad background;
- recent boxes: static ceramic rows with blue inset icon wells and blue-white status plates;
- `管理房间` remains before the room grid and retains its modal behavior.

Do not alter summary math, sample-data reset alerts, room management, list slicing, or state writes.

- [ ] **Step 3: Run the focused test, all logic tests, and typecheck**

Run: `npm test -- src/app/index.test.ts --runInBand && npm test -- --runInBand && npm run typecheck`

Expected: PASS.

---

### Task 5: Implement the approved Boxes screen

**Files:**
- Create: `src/app/boxes-presentation.ts`
- Create: `src/app/boxes-presentation.test.ts`
- Modify: `src/app/boxes.tsx`

**Interfaces:**
- Consumes: the existing sorted boxes, all five `BOX_STATUSES`, navigation, camera/photo functions, and Task 2 primitives.
- Produces: `getMilestoneBoxId(boxes)` and the approved three-record Collector composition for any real state.

- [ ] **Step 1: Write failing milestone-selection tests**

```ts
import { getMilestoneBoxId } from './boxes-presentation';

test('chooses at most one pending box as the yellow focus', () => {
  expect(getMilestoneBoxId([
    { id: 'newer', status: '待整理', updatedAt: 2 },
    { id: 'older', status: '待整理', updatedAt: 1 },
  ])).toBe('newer');
});

test('has no yellow milestone when no box is pending', () => {
  expect(getMilestoneBoxId([{ id: 'box', status: '已装箱', updatedAt: 1 }])).toBeNull();
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test -- src/app/boxes-presentation.test.ts --runInBand`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the approved box-card hierarchy**

Preserve the current `updatedAt` sort, photo picker/camera, modal, delete confirmation, five status actions, and exact data. Restyle:

- 96pt dashed blue photo tile;
- `全部箱子` count and existing record order;
- each box as an 18pt ceramic card with blue code, blue-white status plate, inset route row, two metric cells, exact contents/note, five 44pt wrapping status chips, and 44pt edit/delete actions;
- selected normal statuses are blue; only `getMilestoneBoxId`'s pending selected chip is yellow with ink text;
- delete uses `#A12F2F`, not a generic red palette.

Do not introduce filtering, sorting, overview cards, `查看详情`, or new navigation.

- [ ] **Step 4: Run focused tests, full tests, and typecheck**

Run: `npm test -- src/app/boxes-presentation.test.ts --runInBand && npm test -- --runInBand && npm run typecheck`

Expected: PASS.

---

### Task 6: Implement the approved Memories empty and populated states

**Files:**
- Modify: `src/app/memory/index.tsx`

**Interfaces:**
- Consumes: existing `useMemory()` state, add/delete flows, and shared UI primitives.
- Produces: exact empty-state fidelity and blue-toy styling for existing populated house cards without changing data behavior.

- [ ] **Step 1: Write a failing state-selection test**

Extract `getMemoryHomeState(houseCount)` and test:

```ts
test('uses the approved empty state only when there are no houses', () => {
  expect(getMemoryHomeState(0)).toBe('empty');
  expect(getMemoryHomeState(1)).toBe('list');
});
```

Run: `npm test -- src/app/memory/index.test.ts --runInBand`

Expected: FAIL because the helper/test does not exist.

- [ ] **Step 2: Implement the approved empty state and compatible list state**

- Header: exact copy, wrapping text, 44pt blue `新增家` action.
- Empty: one responsive ceramic tray up to 280pt, one inset ice-blue well up to 200pt, literal `⌂`, exact title/description, no invented instruction modules or yellow decoration.
- Populated: keep current house open/delete behavior and user colors as small data accents; use shallow ceramic rows and 44pt delete targets.
- Modal: preserve exact validation, color selection, and create behavior while adopting the shared theme.

- [ ] **Step 3: Run focused tests, full tests, and typecheck**

Run: `npm test -- src/app/memory/index.test.ts --runInBand && npm test -- --runInBand && npm run typecheck`

Expected: PASS.

---

### Task 7: Install the approved brand into Xcode assets and Launch Screen

**Files:**
- Create: `ios/BanjiaTiaoli/Images.xcassets/AppIcon.appiconset/*.png`
- Modify: `ios/BanjiaTiaoli/Images.xcassets/AppIcon.appiconset/Contents.json`
- Create: `ios/BanjiaTiaoli/Images.xcassets/LaunchLogo.imageset/Contents.json`
- Create: `ios/BanjiaTiaoli/Images.xcassets/LaunchLogo.imageset/*.png`
- Modify: `ios/BanjiaTiaoli/LaunchScreen.storyboard`

**Interfaces:**
- Consumes: confirmed brand v4: blue rounded moving box, white rounded roof/lid, one yellow smile, no face/eyes/microphone/person/text.
- Produces: opaque 1024px App Store icon, required iPhone icon slots, and a native ice-blue launch screen.

- [ ] **Step 1: Generate and visually inspect one 1024×1024 opaque master asset**

Use the image generation tool with the approved brand board as the visual authority. The asset must be flat-framed for App Icon use, with no external rounded mask, no text, and no transparency.

- [ ] **Step 2: Validate the master before installing it**

Run:

```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha ios/BanjiaTiaoli/Images.xcassets/AppIcon.appiconset/AppIcon-1024.png
```

Expected: `1024`, `1024`, and `hasAlpha: no`.

- [ ] **Step 3: Produce exact catalog renditions and update Contents.json**

Generate filenames for 40, 60, 58, 87, 80, 120, 120, 180, and 1024 pixel slots, preserving aspect ratio and RGB color. Reference every filename from the existing slot objects rather than changing target idioms/sizes.

- [ ] **Step 4: Replace the starter Launch Screen**

Use an image view backed by `LaunchLogo`, set the background to `#F3F9FF`, set the wordmark to exact lowercase `banjiatino` in system rounded/bold styling, and remove `BanjiaTiaoli` plus `Powered by React Native`.

- [ ] **Step 5: Validate asset metadata and storyboard compilation**

Run:

```bash
find ios/BanjiaTiaoli/Images.xcassets/AppIcon.appiconset -name '*.png' -maxdepth 1 -print
plutil -lint ios/BanjiaTiaoli/Images.xcassets/AppIcon.appiconset/Contents.json
plutil -lint ios/BanjiaTiaoli/Images.xcassets/LaunchLogo.imageset/Contents.json
ibtool --errors --warnings --notices --compile /tmp/BanjiatinoLaunchScreen.storyboardc ios/BanjiaTiaoli/LaunchScreen.storyboard
```

Expected: all slots exist, both JSON files pass, and Interface Builder compilation exits `0`.

---

### Task 8: Audit remaining screens for theme compatibility

**Files:**
- Modify only as needed: `src/app/items.tsx`
- Modify only as needed: `src/app/search.tsx`
- Modify only as needed: `src/app/memory/[houseId]/index.tsx`
- Modify only as needed: `src/app/memory/[houseId]/[roomId].tsx`
- Modify only as needed: `src/app/storage/[photoId].tsx`
- Modify only as needed: `src/components/room-manager.tsx`
- Modify only as needed: `src/components/memory/floorplan-canvas.tsx`
- Modify only as needed: `src/components/storage/photo-marker-canvas.tsx`

**Interfaces:**
- Consumes: the new global theme and shared primitives.
- Produces: no old green/beige hardcoded visual regressions and no broken controls on non-designed routes.

- [ ] **Step 1: Run the legacy-color audit**

Run:

```bash
rg -n '#2F6B4F|#DDEAE2|#D97A47|#F6E5DA|#F6F4EF|#ECE9E1|#DEDCD5|#F0B17E' App.tsx src
```

Expected: list any remaining literal legacy colors before editing.

- [ ] **Step 2: Replace only presentation literals that conflict with the approved theme**

Use `AppColors` and `AppShadow`; keep semantic danger/error colors, user-selected room/house colors, photo content, floor-plan geometry, marker geometry, and every behavior unchanged. Ensure all touched controls remain 44pt and all essential text wraps.

- [ ] **Step 3: Run static and behavioral verification**

Run:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

Expected: all commands exit `0`.

---

### Task 9: Build, run, and perform visual QA on iOS

**Files:**
- Create: `design-qa.md`
- Inspect: `ios/BanjiaTiaoli.xcworkspace`

**Interfaces:**
- Consumes: all completed implementation tasks and approved Superdesign previews.
- Produces: a fresh build/test record and same-state simulator captures for Home, Boxes, and Memories.

- [ ] **Step 1: Run the complete JS gate**

Run:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

Expected: all pass with zero failures.

- [ ] **Step 2: Build the versioned workspace for an available iPhone Simulator**

Use the shared scheme and an installed simulator destination:

```bash
xcodebuild -workspace ios/BanjiaTiaoli.xcworkspace \
  -scheme BanjiaTiaoli \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  build
```

Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 3: Launch and capture the three approved states**

Use the iOS debugger/simulator browser workflow. Capture:

- Home with the existing sample state;
- Boxes with the three initial boxes and five status controls;
- Memories with zero houses.

Exercise `开始我的搬家` only up to the confirmation alert; do not destructively clear sample data during visual QA. Open/close the create-box and create-house sheets, and verify tab navigation.

- [ ] **Step 4: Compare captures against the exact approved previews**

References:

- Home: `https://p.superdesign.dev/draft/562f483c-4b06-462a-8149-a4066279c172`
- Boxes: `https://p.superdesign.dev/draft/7d4c726f-2073-417e-9daf-7bb0cf9e90ba`
- Memories: `https://p.superdesign.dev/draft/51a2cfbc-0157-4963-8fe9-65d201ab0a89`

Check same viewport/state for spacing, hierarchy, radii, soft shadows, one-yellow-focus rule, nav selection, Dynamic Type wrapping, and content accuracy. Record issues in `design-qa.md`, fix P0/P1/P2 issues, and repeat until it contains `final result: passed`. If capture is unavailable, record `final result: blocked` and do not claim visual completion.

- [ ] **Step 5: Verify the final change scope**

Run:

```bash
git diff --check
git status --short
git diff --name-only
```

Expected: only the planned theme/UI/tests/native assets/design QA files change; no Expo packages, generated Pods, credentials, signing identity, or unrelated user files appear.
