# Key page dependency trees

Only local project imports are shown; React, React Native, React Navigation, native modules, and other `node_modules` dependencies are intentionally omitted. Trees are recursive and preserve direct-import nesting; repeated leaves show where the same shared dependency enters a page.

## Home / 进度

Entry: `src/app/index.tsx`

Dependencies:
- `src/components/ui-kit.tsx`
  - `src/constants/app-theme.ts`
- `src/components/room-manager.tsx`
  - `src/components/ui-kit.tsx`
    - `src/constants/app-theme.ts`
  - `src/constants/app-theme.ts`
  - `src/context/moving-context.tsx`
    - `src/data/initial-data.ts`
      - `src/types/moving.ts`
    - `src/logic/photo-store.ts`
    - `src/logic/moving.ts`
      - `src/data/initial-data.ts`
        - `src/types/moving.ts`
      - `src/types/moving.ts`
    - `src/types/moving.ts`
  - `src/types/moving.ts`
- `src/constants/app-theme.ts`
- `src/context/moving-context.tsx`
  - `src/data/initial-data.ts`
    - `src/types/moving.ts`
  - `src/logic/photo-store.ts`
  - `src/logic/moving.ts`
    - `src/data/initial-data.ts`
      - `src/types/moving.ts`
    - `src/types/moving.ts`
  - `src/types/moving.ts`

## Items / 物品

Entry: `src/app/items.tsx`

Dependencies:
- `src/components/ui-kit.tsx`
  - `src/constants/app-theme.ts`
- `src/constants/app-theme.ts`
- `src/context/moving-context.tsx`
  - `src/data/initial-data.ts`
    - `src/types/moving.ts`
  - `src/logic/photo-store.ts`
  - `src/logic/moving.ts`
    - `src/data/initial-data.ts`
      - `src/types/moving.ts`
    - `src/types/moving.ts`
  - `src/types/moving.ts`
- `src/types/moving.ts`

## Boxes / 箱子

Entry: `src/app/boxes.tsx`

Dependencies:
- `src/components/ui-kit.tsx`
  - `src/constants/app-theme.ts`
- `src/constants/app-theme.ts`
- `src/context/moving-context.tsx`
  - `src/data/initial-data.ts`
    - `src/types/moving.ts`
  - `src/logic/photo-store.ts`
  - `src/logic/moving.ts`
    - `src/data/initial-data.ts`
      - `src/types/moving.ts`
    - `src/types/moving.ts`
  - `src/types/moving.ts`
- `src/logic/photo-store.ts`
- `src/types/moving.ts`
- `src/navigation/types.ts`

## Search / 查找

Entry: `src/app/search.tsx`

Dependencies:
- `src/components/ui-kit.tsx`
  - `src/constants/app-theme.ts`
- `src/constants/app-theme.ts`
- `src/context/moving-context.tsx`
  - `src/data/initial-data.ts`
    - `src/types/moving.ts`
  - `src/logic/photo-store.ts`
  - `src/logic/moving.ts`
    - `src/data/initial-data.ts`
      - `src/types/moving.ts`
    - `src/types/moving.ts`
  - `src/types/moving.ts`

## Memory Home / 回忆

Entry: `src/app/memory/index.tsx`

Dependencies:
- `src/components/ui-kit.tsx`
  - `src/constants/app-theme.ts`
- `src/constants/app-theme.ts`
- `src/context/memory-context.tsx`
  - `src/logic/photo-store.ts`
  - `src/logic/memory.ts`
    - `src/types/memory.ts`
  - `src/types/memory.ts`
- `src/navigation/types.ts`

## Rooms

Entry: `src/app/memory/[houseId]/index.tsx`

Dependencies:
- `src/components/ui-kit.tsx`
  - `src/constants/app-theme.ts`
- `src/constants/app-theme.ts`
- `src/context/memory-context.tsx`
  - `src/logic/photo-store.ts`
  - `src/logic/memory.ts`
    - `src/types/memory.ts`
  - `src/types/memory.ts`
- `src/navigation/types.ts`

## Room Editor

Entry: `src/app/memory/[houseId]/[roomId].tsx`

Dependencies:
- `src/components/memory/floorplan-canvas.tsx`
  - `src/constants/app-theme.ts`
  - `src/logic/memory.ts`
    - `src/types/memory.ts`
  - `src/types/memory.ts`
- `src/components/ui-kit.tsx`
  - `src/constants/app-theme.ts`
- `src/constants/app-theme.ts`
- `src/context/memory-context.tsx`
  - `src/logic/photo-store.ts`
  - `src/logic/memory.ts`
    - `src/types/memory.ts`
  - `src/types/memory.ts`
- `src/types/memory.ts`
- `src/navigation/types.ts`

## Storage Photo

Entry: `src/app/storage/[photoId].tsx`

Dependencies:
- `src/components/storage/photo-marker-canvas.tsx`
  - `src/constants/app-theme.ts`
  - `src/logic/storage-marker.ts`
    - `src/types/moving.ts`
  - `src/types/moving.ts`
- `src/components/ui-kit.tsx`
  - `src/constants/app-theme.ts`
- `src/constants/app-theme.ts`
- `src/context/moving-context.tsx`
  - `src/data/initial-data.ts`
    - `src/types/moving.ts`
  - `src/logic/photo-store.ts`
  - `src/logic/moving.ts`
    - `src/data/initial-data.ts`
      - `src/types/moving.ts`
    - `src/types/moving.ts`
  - `src/types/moving.ts`
- `src/types/moving.ts`
- `src/navigation/types.ts`

