# Extractable Superdesign components

## Layout components

## AppShell
- Source: `App.tsx`
- Category: layout
- Description: Root providers, status bar, navigation container, and hidden-header native stack.
- Extractable props: `activeRoute` (route state), detail-screen visibility and navigation state.
- Hardcoded: provider order, dark status bar, hidden headers, root route names, navigator structure.

## BottomNavigation
- Source: `App.tsx#MainTabs`
- Category: layout
- Description: Persistent five-item bottom navigation in the exact order 进度、物品、箱子、查找、回忆.
- Extractable props: `activeItem` (default: `Home`), navigation targets/current tab.
- Hardcoded: five route names, Chinese labels, glyph icons, 82pt absolute bar geometry, color and type styles.

## Basic components

## Screen
- Source: `src/components/ui-kit.tsx`
- Category: basic
- Description: Safe-area page wrapper with optional scrolling and standard page padding.
- Extractable props: `scroll` (boolean, default: `true`).
- Hardcoded: safe-area edges, keyboard tap behavior, hidden scroll indicator, content styles.

## PageHeader
- Source: `src/components/ui-kit.tsx`
- Category: basic
- Description: Shared page header with optional eyebrow, description, and action content.
- Extractable props: `eyebrow?: string`, `title: string`, `description?: string`, `action?: ReactNode`.
- Hardcoded: eyebrow/title/description typography, spacing, and header layout.

## Card
- Source: `src/components/ui-kit.tsx`
- Category: basic
- Description: Shared surfaced container for page content and records.
- Extractable props: page-specific children/content; optional style.
- Hardcoded: background, border, radius, padding, and shadow styling.

## PrimaryButton
- Source: `src/components/ui-kit.tsx`
- Category: basic
- Description: Main action button with disabled and pressed feedback.
- Extractable props: `label`, `onPress`, `disabled`, `compact`.
- Hardcoded: typography, minimum height, radius, spacing, pressed/disabled visual treatment.

## StatusBadge
- Source: `src/components/ui-kit.tsx`
- Category: basic
- Description: Compact semantic status label used by item and box cards.
- Extractable props: `label`, `tone` (`neutral`, `success`, `warning`, or `accent`).
- Hardcoded: supported status-to-color mapping, label typography, capsule geometry.

## ModalSheet
- Source: `src/components/ui-kit.tsx`
- Category: basic
- Description: Shared keyboard-aware modal sheet for create/edit flows.
- Extractable props: `visible`, `title`, `onClose`, dynamic children/form state.
- Hardcoded: presentation animation, transparent backdrop, keyboard behavior, close affordance and sheet styling.
