# Banjiatino Superdesign Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce reviewable Superdesign brand, App Icon, and UI drafts for Banjiatino's approved blue-and-white dimensional toy direction without changing application code.

**Architecture:** Analyze the current React Native UI into Superdesign context files, reproduce the existing Home screen as visual ground truth, then branch two layout variants that share one strict design system. After the user selects a Home direction, extend that confirmed draft to Boxes and Memories so all screens inherit the same component language.

**Tech Stack:** React Native 0.81 source context, React Navigation, Superdesign CLI, Markdown design-system context

## Global Constraints

- Main palette: `#176BDB`, `#2F80ED`, `#BFDFFF`, `#F3F9FF`, `#FFFFFF`.
- Yellow accents: `#FFC928` and `#FFF3BD`; visible yellow area stays below 10% of each screen.
- Materials: smooth plastic, white ceramic, and semi-matte rubber with a consistent top-left light source.
- No kraft paper, old leather, yellowed photos, heavy wood grain, dirty texture, retro filters, or Liquid Glass as the main material.
- No cold-humor copy, cartoon characters, celebrity likeness, or direct reproduction of a specific Apple UI.
- Logo meaning is limited to moving box, roof, and subtle smile; do not add the removed microphone-handle idea.
- Do not change app functionality, navigation, data models, React Native code, or Xcode assets during this plan.
- Every Superdesign generation passes `.superdesign/design-system.md` and the relevant source context.

---

### Task 1: Build Superdesign repository context

**Files:**
- Create: `.superdesign/init/components.md`
- Create: `.superdesign/init/layouts.md`
- Create: `.superdesign/init/routes.md`
- Create: `.superdesign/init/theme.md`
- Create: `.superdesign/init/pages.md`
- Create: `.superdesign/init/extractable-components.md`
- Create: `.superdesign/design-system.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `App.tsx`, `src/app/**/*.tsx`, `src/components/**/*.tsx`, `src/constants/app-theme.ts`, `src/navigation/types.ts`, and the approved design spec.
- Produces: six non-empty init files plus `.superdesign/design-system.md` for every later CLI call.

- [ ] **Step 1: Check whether initialization is already complete**

Run:

```bash
for file in components layouts routes theme pages extractable-components; do test -s ".superdesign/init/$file.md" || exit 1; done
```

Expected: exit `0` only when all six mandatory context files exist and are non-empty. If it exits `1`, regenerate the complete set rather than partially reusing it.

- [ ] **Step 2: Generate all six init documents from the current source**

Follow the Superdesign `INIT.md` schema exactly:

- `components.md`: full source for shared components in `src/components/ui-kit.tsx`, `src/components/room-manager.tsx`, `src/components/memory/floorplan-canvas.tsx`, and `src/components/storage/photo-marker-canvas.tsx`.
- `layouts.md`: full `App.tsx` plus a description of the root stack and five-tab shell.
- `routes.md`: all routes from `App.tsx` and `src/navigation/types.ts` with their component paths.
- `theme.md`: compact token summary first, then full `src/constants/app-theme.ts`.
- `pages.md`: recursive dependency trees for Home, Items, Boxes, Search, Memory Home, Rooms, Room Editor, and Storage Photo.
- `extractable-components.md`: App shell and bottom navigation as layout candidates; `Screen`, `PageHeader`, `Card`, `PrimaryButton`, `StatusBadge`, and `ModalSheet` as basic candidates.

- [ ] **Step 3: Create the strict Superdesign design system**

Write `.superdesign/design-system.md` by adapting the complete approved spec at `docs/superpowers/specs/2026-08-11-banjiatino-blue-toy-ui-design.md`. Include product context, navigation, exact tokens, lighting, materials, component states, motion, accessibility, page guidance, and prohibited styles.

- [ ] **Step 4: Ignore Superdesign temporary conversion files**

Add this exact entry to `.gitignore` if missing:

```gitignore
/.superdesign/tmp/
```

- [ ] **Step 5: Validate context completeness and design fidelity**

Run:

```bash
for file in components layouts routes theme pages extractable-components; do test -s ".superdesign/init/$file.md" || exit 1; done
test -s .superdesign/design-system.md
rg -n "#176BDB|#2F80ED|#FFC928|yellow area|10%|top-left" .superdesign/design-system.md
! rg -n "microphone|麦克风|冷幽默文案示例" .superdesign/design-system.md
```

Expected: all files are non-empty, required visual constraints are found, and removed concepts are absent.

### Task 2: Establish the Superdesign project and baseline

**Files:**
- Read: `.superdesign/init/*.md`
- Read: `.superdesign/design-system.md`
- Read: `App.tsx`
- Read: `src/app/index.tsx`
- Read: `src/components/ui-kit.tsx`
- Read: `src/constants/app-theme.ts`

**Interfaces:**
- Consumes: Task 1 context files and the current Home render branch.
- Produces: one Superdesign project ID, canvas URL, and one baseline Home draft ID.

- [ ] **Step 1: Run the mandatory CLI preflight**

Run:

```bash
npx --yes @superdesign/cli@latest
```

Expected: the CLI prints an `auth:` line and recent projects. If unauthenticated, run `npx --yes @superdesign/cli@latest login`, wait for success, then continue.

- [ ] **Step 2: Read the command flags before first use**

Run:

```bash
npx --yes @superdesign/cli@latest create-project --help
npx --yes @superdesign/cli@latest create-design-draft --help
npx --yes @superdesign/cli@latest iterate-design-draft --help
npx --yes @superdesign/cli@latest execute-flow-pages --help
```

Expected: all help commands exit `0`.

- [ ] **Step 3: Create the project**

Run:

```bash
npx --yes @superdesign/cli@latest create-project --title "Banjiatino Blue Toy UI"
```

Expected: output contains the server-generated project ID and `canvas:` URL. Preserve both from the output; do not construct them manually.

- [ ] **Step 4: Reproduce the existing Home screen**

Run `create-design-draft` with one reproduction-only prompt, device set to iPhone, and these context files:

```text
.superdesign/design-system.md
.superdesign/init/theme.md
App.tsx
src/app/index.tsx
src/components/ui-kit.tsx
src/components/room-manager.tsx
src/constants/app-theme.ts
```

Prompt:

```text
Create a pixel-accurate structural reproduction of the current Banjiatino Home screen for iPhone. Preserve the current information architecture, sections, content hierarchy, navigation count, card ordering, controls, and realistic Chinese content from the supplied React Native source. This is the visual ground-truth draft only: do not apply the new blue toy redesign yet. Use the source code as the single source of truth.
```

Expected: output contains one baseline draft ID plus `canvas:` and `preview:` links.

### Task 3: Generate the Logo and App Icon concept board

**Files:**
- Read: `.superdesign/design-system.md`
- Read: `docs/superpowers/specs/2026-08-11-banjiatino-blue-toy-ui-design.md`

**Interfaces:**
- Consumes: Task 2 project ID and the approved brand concept.
- Produces: one editable 1500×750 Superdesign brand board draft with the App Icon mark and `banjiatino` wordmark.

- [ ] **Step 1: Generate an asset-free brand board**

Run `create-design-draft --kind graphic --width 1500 --height 750` in the existing project with `.superdesign/design-system.md` as context and this single prompt:

```text
Design an editable Banjiatino logo and App Icon concept board on an EXACTLY 1500x750px canvas; nothing may overflow or scroll. Use a clean split layout with generous white and ice-blue space. Left: one large 1024-style rounded-square App Icon preview and two small-size previews. The mark is a rounded saturated-blue moving box, a white lid forming a simplified house roof, and one restrained yellow packing-tape curve forming a subtle smile. It must have no face, eyes, person, microphone, letters, or celebrity reference. Right: the exact lowercase wordmark "banjiatino", the icon construction logic, and the approved blue/white/yellow swatches. The result should feel like a premium adult collectible toy: smooth plastic, white ceramic, semi-matte rubber, top-left highlight, short soft shadow. Yellow remains below 10% of visible area. No kraft paper, aged materials, retro filter, joke copy, or direct Apple UI imitation. Use ONLY the fonts, colors, spacing, lighting, materials, and component styles defined in the design system. Do not introduce any other fonts, colors, or visual styles.
```

Expected: one brand-board draft ID plus `canvas:` and `preview:` links.

- [ ] **Step 2: Visually inspect the board**

Open the returned preview in the in-app browser. Check the exact wordmark spelling, icon recognizability at small size, blue-white first impression, yellow area, absence of the removed microphone idea, and fixed-canvas overflow.

If a concrete defect exists, run exactly one `iterate-design-draft --mode replace` correction and inspect it again. Do not branch stylistic alternatives without user approval.

### Task 4: Generate two blue-toy Home variants

**Files:**
- Read: `.superdesign/design-system.md`
- Read: the same context files used for the baseline draft

**Interfaces:**
- Consumes: Task 2 baseline draft ID.
- Produces: two branch draft IDs for user comparison.

- [ ] **Step 1: Branch Variant A — Collector Toy Modules**

Use `iterate-design-draft --mode branch` with this prompt as the first `-p`:

```text
Redesign the Home screen as a bright adult collectible-toy organizer. Keep the exact existing information architecture and five-tab navigation. Use white ceramic panels, saturated blue rounded plastic modules, inset toy-rail progress, compact top-left highlights, and short soft shadows. Reserve yellow for the single current milestone and primary completion cue, below 10% visible area. Copy must remain direct and friendly with no jokes. Use ONLY the fonts, colors, spacing, lighting, materials, and component styles defined in the design system. Do not introduce any other fonts, colors, or visual styles.
```

- [ ] **Step 2: Branch Variant B — Modular Playset Dashboard**

Use this prompt as the second `-p` in the same branch command:

```text
Redesign the Home screen as a bright modular playset dashboard for adults. Keep the exact existing information architecture and five-tab navigation, but group progress, rooms, boxes, and tasks into clearly fitted blue-and-white compartments with stronger physical depth than Variant A. Use one yellow focus control only; keep total yellow below 10%. Avoid childish mascots, exaggerated bouncing shapes, retro materials, and humor copy. Use ONLY the fonts, colors, spacing, lighting, materials, and component styles defined in the design system. Do not introduce any other fonts, colors, or visual styles.
```

Pass the verbatim user request for this design round through `--user-request` and pass the same context files as Task 2.

Expected: two distinct branch draft IDs, both linked to the baseline and visible on the same canvas.

Assign the exact IDs returned by Superdesign to `BANJIATINO_VARIANT_A_DRAFT_ID` and `BANJIATINO_VARIANT_B_DRAFT_ID` in the active shell session before inspection.

- [ ] **Step 3: Inspect both drafts before presenting them**

Run for each branch:

```bash
npx --yes @superdesign/cli@latest get-design --draft-id "$BANJIATINO_VARIANT_A_DRAFT_ID" --json
npx --yes @superdesign/cli@latest get-design --draft-id "$BANJIATINO_VARIANT_B_DRAFT_ID" --json
```

Check each draft against the acceptance criteria: blue-white first impression, yellow below 10%, consistent light direction, no aged materials, no cold humor, and no microphone motif.

- [ ] **Step 4: Present the canvas for direction selection**

Give the user the exact `canvas:` link returned by the CLI and ask them to choose Variant A or Variant B before spending credits on more pages.

### Task 5: Extend the selected direction to Boxes and Memories

**Files:**
- Read: `.superdesign/design-system.md`
- Read: `src/app/boxes.tsx`
- Read: `src/app/memory/index.tsx`
- Read: `src/components/ui-kit.tsx`
- Read: `.superdesign/init/pages.md`

**Interfaces:**
- Consumes: the user-confirmed Home draft ID from Task 4.
- Produces: Boxes and Memories draft IDs inheriting the confirmed style.

- [ ] **Step 1: Confirm both flow-page prompts with the user**

Boxes prompt:

```text
Create the existing Box list screen using the confirmed blue-white dimensional toy system. Preserve current box data, actions, photo entry, room mapping, and status hierarchy. Represent boxes as blue-white modular moving containers, not brown cardboard. Yellow is reserved for the single focus action and remains below 10%.
```

Memories prompt:

```text
Create the existing Memories home screen using the confirmed blue-white dimensional toy system. Preserve current house list and navigation. Present houses and photos in clean blue-white dimensional frames and modular archive trays, with no yellowed photos, leather, kraft paper, or nostalgia filter. Yellow marks only the current selection and remains below 10%.
```

- [ ] **Step 2: Generate both pages from the confirmed Home draft**

Run `execute-flow-pages` with the confirmed Home draft ID, both approved page prompts, `.superdesign/design-system.md`, `.superdesign/init/theme.md`, and the relevant source files.

Expected: two page drafts on the existing project canvas, inheriting the selected Home component system.

- [ ] **Step 3: Inspect generated pages**

Run `get-design --json` for both drafts. Verify shared navigation, consistent shadows and radii, source-aligned content, no forbidden materials, and no unapproved copy.

- [ ] **Step 4: Present the complete three-screen system**

Surface the exact canvas URL and ask whether the user wants to refine the UI, refine the Logo/App Icon board, or create a React Native implementation plan.

### Task 6: Validate design-only scope

**Files:**
- Inspect: repository working tree

**Interfaces:**
- Consumes: all prior design outputs.
- Produces: a clear handoff with no application-code mutation.

- [ ] **Step 1: Verify application source was not changed by the design round**

Run:

```bash
git status --short
git diff --check
```

Expected: design documentation and `.superdesign/` context may change; no new modifications should appear in `App.tsx`, `src/`, `ios/`, or dependency manifests as a result of this design plan.

- [ ] **Step 2: Report the handoff**

Report the canvas link, generated draft titles, validation performed, unimplemented items, and that React Native/Xcode code remains untouched.
