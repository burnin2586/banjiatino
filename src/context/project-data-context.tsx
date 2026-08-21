import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { OutboxOperation } from '@/features/sync/sync-types';
import { OutboxRepository } from '@/repositories/outbox-repository';
import {
  executeDatabaseQuery,
  notifyProjectCommitted,
  subscribeToProject,
  withDatabaseTransaction,
  type DatabaseTransaction,
} from '@/storage/database/connection';
import type {
  BoxStatus,
  ItemAction,
  ItemStatus,
  MarkerRect,
  MovingBox,
  MovingItem,
  MovingState,
  MovingTask,
  Room,
  RoomKind,
  StoragePhoto,
} from '@/types/moving';
import { randomUuid } from '@/utils/uuid';
import { buildLookups, type Lookups } from './moving-lookups';

const BOX_STATUS_TO_PROTOCOL: Record<BoxStatus, string> = {
  '待整理': 'draft',
  '已装箱': 'packed',
  '已搬走': 'moved',
  '已到达': 'arrived',
  '已拆箱': 'unpacked',
};

const PROTOCOL_TO_BOX_STATUS: Record<string, BoxStatus> = {
  draft: '待整理',
  packed: '已装箱',
  moved: '已搬走',
  arrived: '已到达',
  unpacked: '已拆箱',
};

const DEFAULT_ROOM_COLOR = '#BFDCCB';

export type RoomInput = { name: string; color: string; kind: RoomKind };
export type BoxInput = { name: string; sourceRoomId: string; destinationRoomId: string; note?: string };
export type ItemInput = {
  name: string;
  quantity: number;
  originalLocation: string;
  destinationLocation: string;
  boxId: string | null;
  action: ItemAction;
  note?: string;
};
export type TaskInput = { title: string; dueOffsetDays: number; note?: string };

export type ProjectDataSnapshot = {
  state: MovingState;
  isLoading: boolean;
  lookups: Lookups;
};

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export function createAsyncPhotoStorage(): KeyValueStorage {
  // Lazy require: AsyncStorage's ESM entry must stay out of the Jest transform path.
  const Storage = require('@react-native-async-storage/async-storage').default;
  return Storage as KeyValueStorage;
}

export type ProjectDataControllerOptions = {
  projectId: string;
  actorId: string;
  now?: () => number;
  generateId?: () => string;
  onLocalCommit?: () => void;
  storage?: KeyValueStorage;
};


function toMilliseconds(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function storagePhotoKey(projectId: string): string {
  return `banjiatino-storage-photos-${projectId}`;
}

type Entity = 'room' | 'box' | 'item' | 'task';

/**
 * Repository-backed moving data for one collaboration project. Every mutation writes the
 * local row plus its outbox operation in a single transaction, refreshes the projection
 * immediately, and wakes the sync engine; a failing sync trigger never hides local writes.
 */
export class ProjectDataController {
  private readonly projectId: string;
  private readonly actorId: string;
  private readonly now: () => number;
  private readonly generateId: () => string;
  private readonly onLocalCommit?: () => void;
  private readonly storage: KeyValueStorage;
  private readonly listeners = new Set<() => void>();
  private snapshot: ProjectDataSnapshot;
  private disposed = false;
  private pendingRefresh: Promise<void> = Promise.resolve();

  constructor(options: ProjectDataControllerOptions) {
    this.projectId = options.projectId;
    this.actorId = options.actorId;
    this.now = options.now ?? (() => Date.now());
    this.generateId = options.generateId ?? randomUuid;
    this.onLocalCommit = options.onLocalCommit;
    this.storage = options.storage ?? createAsyncPhotoStorage();
    this.snapshot = {
      state: {
        schemaVersion: 4,
        movingDate: null,
        tasks: [],
        rooms: [],
        boxes: [],
        items: [],
        storagePhotos: [],
      },
      isLoading: true,
      lookups: buildLookups({
        schemaVersion: 4,
        movingDate: null,
        tasks: [],
        rooms: [],
        boxes: [],
        items: [],
        storagePhotos: [],
      }),
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): ProjectDataSnapshot {
    return this.snapshot;
  }

  /** Resolves once wakeup-triggered reloads have settled (used by tests and the provider). */
  whenIdle(): Promise<void> {
    return this.pendingRefresh;
  }

  async load(): Promise<void> {
    await this.ensureProjectRow();
    const unsubscribe = subscribeToProject(this.projectId, () => {
      // Coalesce wakeup-triggered reloads so late events never race a closed database.
      this.pendingRefresh = this.pendingRefresh
        .then(() => {
          if (!this.disposed) return this.refresh();
        })
        .catch(() => undefined);
    });
    this.unsubscribeProject = unsubscribe;
    await this.refresh();
    this.publish({ isLoading: false });
  }

  private unsubscribeProject?: () => void;

  /**
   * Joined devices learn the project id from the invitation before any local row exists;
   * every table references this row, so create a placeholder before the first pull.
   */
  private async ensureProjectRow(): Promise<void> {
    const nowIso = new Date().toISOString();
    await executeDatabaseQuery(
      `INSERT INTO moving_projects (id, name, created_by, created_at, updated_at)
       VALUES (?, '家庭搬家项目', 'local', ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      [this.projectId, nowIso, nowIso],
    );
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.unsubscribeProject?.();
    this.listeners.clear();
    await this.pendingRefresh;
  }

  private async refresh(): Promise<void> {
    const state = await this.readState();
    this.snapshot = { state, isLoading: this.snapshot.isLoading, lookups: buildLookups(state) };
    for (const listener of this.listeners) listener();
  }

  private publish(patch: Partial<ProjectDataSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  private async readState(): Promise<MovingState> {
    const roomsResult = await this.readTable(
      `SELECT id, name, color, room_kind, sort_order FROM rooms
       WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC`,
    );
    const boxesResult = await this.readTable(
      `SELECT id, display_number, label, notes, status, source_room_id, destination_room_id,
              storage_photo_id, marker_rect, created_at, updated_at
       FROM moving_boxes WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at ASC, id ASC`,
    );
    const itemsResult = await this.readTable(
      `SELECT id, box_id, name, notes, quantity, original_location, destination_location, action, status,
              created_at, updated_at
       FROM moving_items WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at ASC, id ASC`,
    );
    const tasksResult = await this.readTable(
      `SELECT id, title, notes, status, due_offset_days, completed_at, created_at, updated_at
       FROM moving_tasks WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at ASC, id ASC`,
    );
    const project = await this.readTable(
      'SELECT moving_date FROM moving_projects WHERE id = ?',
    );

    const rooms: Room[] = roomsResult.map(row => ({
      id: row.id as string,
      name: row.name as string,
      color: (row.color as string | null) ?? DEFAULT_ROOM_COLOR,
      kind: (row.room_kind as RoomKind) ?? 'source',
      order: Number(row.sort_order ?? 0),
    }));

    const boxes: MovingBox[] = boxesResult.map(row => ({
      id: row.id as string,
      code: row.display_number === null || row.display_number === undefined
        ? null
        : `BOX-${String(Number(row.display_number)).padStart(3, '0')}`,
      name: (row.label as string) ?? '',
      sourceRoomId: (row.source_room_id as string | null) ?? '',
      destinationRoomId: (row.destination_room_id as string | null) ?? '',
      status: PROTOCOL_TO_BOX_STATUS[(row.status as string) ?? 'draft'] ?? '待整理',
      note: (row.notes as string | null) ?? '',
      ...(row.storage_photo_id ? { storagePhotoId: row.storage_photo_id as string } : {}),
      ...(row.marker_rect
        ? { markerRect: JSON.parse(row.marker_rect as string) as MarkerRect }
        : {}),
      createdAt: toMilliseconds(row.created_at),
      updatedAt: toMilliseconds(row.updated_at),
    }));

    const items: MovingItem[] = itemsResult.map(row => ({
      id: row.id as string,
      name: row.name as string,
      quantity: Number(row.quantity ?? 1),
      originalLocation: (row.original_location as string | null) ?? '',
      destinationLocation: (row.destination_location as string | null) ?? '',
      boxId: (row.box_id as string | null) ?? null,
      action: ((row.action as ItemAction | null) ?? '待决定'),
      status: ((row.status as ItemStatus | null) ?? '待整理'),
      note: (row.notes as string | null) ?? '',
      createdAt: toMilliseconds(row.created_at),
      updatedAt: toMilliseconds(row.updated_at),
    }));

    const tasks: MovingTask[] = tasksResult.map(row => ({
      id: row.id as string,
      title: row.title as string,
      dueOffsetDays: Number(row.due_offset_days ?? 0),
      done: row.status === 'completed',
      note: (row.notes as string | null) ?? '',
      createdAt: toMilliseconds(row.created_at),
      updatedAt: toMilliseconds(row.updated_at),
    }));

    const movingDateRaw = project[0]?.moving_date;
    const movingDate = typeof movingDateRaw === 'string'
      ? Date.parse(`${movingDateRaw}T00:00:00Z`)
      : null;

    const storedPhotos = await this.storage.getItem(storagePhotoKey(this.projectId));
    const storagePhotos: StoragePhoto[] = storedPhotos ? JSON.parse(storedPhotos) : [];

    return {
      schemaVersion: 4,
      movingDate: Number.isFinite(movingDate as number) ? movingDate : null,
      tasks,
      rooms,
      boxes,
      items,
      storagePhotos,
    };
  }

  private async readTable(sql: string): Promise<Array<Record<string, unknown>>> {
    const result = await executeDatabaseQuery(sql, [this.projectId]);
    return result.rows as Array<Record<string, unknown>>;
  }

  private operation(
    entity: Entity,
    entityId: string,
    action: OutboxOperation['action'],
    baseVersion: number,
    payload: Record<string, unknown>,
  ): OutboxOperation {
    return {
      operationId: this.generateId(),
      projectId: this.projectId,
      entityType: entity,
      entityId,
      action,
      baseVersion,
      payload,
      createdAt: this.now(),
      attemptCount: 0,
    };
  }

  private async commit(
    write: (tx: DatabaseTransaction) => Promise<void>,
    operation?: OutboxOperation,
  ): Promise<void> {
    const outbox = new OutboxRepository();
    await withDatabaseTransaction(async tx => {
      await write(tx);
      if (operation) await outbox.insert(tx, operation);
    });
    await this.refresh();
    notifyProjectCommitted(this.projectId);
    if (this.onLocalCommit) {
      try {
        this.onLocalCommit();
      } catch {
        // Sync failures surface through the sync banner; local data stays visible.
      }
    }
  }

  private async rowVersion(entity: Entity, entityId: string): Promise<number> {
    const tables: Record<Entity, string> = {
      room: 'rooms',
      box: 'moving_boxes',
      item: 'moving_items',
      task: 'moving_tasks',
    };
    const result = await executeDatabaseQuery(
      `SELECT version FROM ${tables[entity]} WHERE project_id = ? AND id = ?`,
      [this.projectId, entityId],
    );
    return Number((result.rows[0] as { version?: unknown } | undefined)?.version ?? 0);
  }

  async addRoom(input: RoomInput): Promise<string> {
    const id = this.generateId();
    const nowIso = new Date(this.now()).toISOString();
    const order = this.snapshot.state.rooms.length;
    await this.commit(async tx => {
      await tx.execute(
        `INSERT INTO rooms (id, project_id, name, room_kind, color, sort_order, created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, this.projectId, input.name, input.kind, input.color, order, this.actorId, this.actorId, nowIso, nowIso],
      );
    }, this.operation('room', id, 'create', 0, { name: input.name, room_kind: input.kind }));
    return id;
  }

  async updateRoom(roomId: string, input: Pick<RoomInput, 'name' | 'color'>): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        'UPDATE rooms SET name = ?, color = ?, updated_by = ?, updated_at = ? WHERE project_id = ? AND id = ?',
        [input.name, input.color, this.actorId, nowIso, this.projectId, roomId],
      );
    }, this.operation('room', roomId, 'update', await this.rowVersion('room', roomId), { name: input.name }));
  }

  async deleteRoom(roomId: string): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        'UPDATE rooms SET deleted_at = ?, updated_by = ?, updated_at = ? WHERE project_id = ? AND id = ?',
        [nowIso, this.actorId, nowIso, this.projectId, roomId],
      );
    }, this.operation('room', roomId, 'soft_delete', await this.rowVersion('room', roomId), {}));
  }

  async addBox(input: BoxInput): Promise<string> {
    const id = this.generateId();
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        `INSERT INTO moving_boxes (id, project_id, display_number, label, notes, status, source_room_id, destination_room_id, created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
        [id, this.projectId, input.name, input.note ?? null,
          input.sourceRoomId || null, input.destinationRoomId || null,
          this.actorId, this.actorId, nowIso, nowIso],
      );
    }, this.operation('box', id, 'create', 0, {
      label: input.name,
      notes: input.note ?? null,
      status: 'draft',
      ...(input.sourceRoomId ? { source_room_id: input.sourceRoomId } : {}),
      ...(input.destinationRoomId ? { destination_room_id: input.destinationRoomId } : {}),
    }));
    return id;
  }

  async updateBox(boxId: string, input: BoxInput): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        `UPDATE moving_boxes SET label = ?, notes = ?, source_room_id = ?, destination_room_id = ?, updated_by = ?, updated_at = ?
         WHERE project_id = ? AND id = ?`,
        [input.name, input.note ?? null, input.sourceRoomId || null, input.destinationRoomId || null,
          this.actorId, nowIso, this.projectId, boxId],
      );
    }, this.operation('box', boxId, 'update', await this.rowVersion('box', boxId), {
      label: input.name,
      ...(input.note !== undefined ? { notes: input.note } : {}),
      ...(input.sourceRoomId ? { source_room_id: input.sourceRoomId } : {}),
      ...(input.destinationRoomId ? { destination_room_id: input.destinationRoomId } : {}),
    }));
  }

  async setBoxStatus(boxId: string, status: BoxStatus): Promise<void> {
    const protocolStatus = BOX_STATUS_TO_PROTOCOL[status];
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        'UPDATE moving_boxes SET status = ?, updated_by = ?, updated_at = ? WHERE project_id = ? AND id = ?',
        [protocolStatus, this.actorId, nowIso, this.projectId, boxId],
      );
    }, this.operation('box', boxId, 'set_status', await this.rowVersion('box', boxId), { status: protocolStatus }));
  }

  async deleteBox(boxId: string): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        'UPDATE moving_boxes SET deleted_at = ?, updated_by = ?, updated_at = ? WHERE project_id = ? AND id = ?',
        [nowIso, this.actorId, nowIso, this.projectId, boxId],
      );
    }, this.operation('box', boxId, 'soft_delete', await this.rowVersion('box', boxId), {}));
  }

  async addItem(input: ItemInput): Promise<string> {
    const id = this.generateId();
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        `INSERT INTO moving_items (id, project_id, box_id, name, notes, quantity, original_location, destination_location, action, status, created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, this.projectId, input.boxId, input.name, input.note ?? null, input.quantity,
          input.originalLocation, input.destinationLocation, input.action, '待整理',
          this.actorId, this.actorId, nowIso, nowIso],
      );
    }, this.operation('item', id, 'create', 0, {
      name: input.name,
      notes: input.note ?? null,
      ...(input.boxId ? { box_id: input.boxId } : {}),
    }));
    return id;
  }

  async setItemStatus(itemId: string, status: ItemStatus): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        'UPDATE moving_items SET status = ?, updated_at = ? WHERE project_id = ? AND id = ?',
        [status, nowIso, this.projectId, itemId],
      );
    });
  }

  async updateItem(itemId: string, input: ItemInput): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        `UPDATE moving_items SET name = ?, notes = ?, box_id = ?, quantity = ?, original_location = ?, destination_location = ?, action = ?, updated_by = ?, updated_at = ?
         WHERE project_id = ? AND id = ?`,
        [input.name, input.note ?? null, input.boxId, input.quantity,
          input.originalLocation, input.destinationLocation, input.action,
          this.actorId, nowIso, this.projectId, itemId],
      );
    }, this.operation('item', itemId, 'update', await this.rowVersion('item', itemId), {
      name: input.name,
      ...(input.note !== undefined ? { notes: input.note } : {}),
      ...(input.boxId ? { box_id: input.boxId } : {}),
    }));
  }

  async deleteItem(itemId: string): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        'UPDATE moving_items SET deleted_at = ?, updated_by = ?, updated_at = ? WHERE project_id = ? AND id = ?',
        [nowIso, this.actorId, nowIso, this.projectId, itemId],
      );
    }, this.operation('item', itemId, 'soft_delete', await this.rowVersion('item', itemId), {}));
  }

  async addTask(input: TaskInput): Promise<string> {
    const id = this.generateId();
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        `INSERT INTO moving_tasks (id, project_id, title, notes, status, due_offset_days, created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
        [id, this.projectId, input.title, input.note ?? null, input.dueOffsetDays,
          this.actorId, this.actorId, nowIso, nowIso],
      );
    }, this.operation('task', id, 'create', 0, { title: input.title, notes: input.note ?? null }));
    return id;
  }

  async updateTask(taskId: string, input: TaskInput): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        'UPDATE moving_tasks SET title = ?, notes = ?, due_offset_days = ?, updated_by = ?, updated_at = ? WHERE project_id = ? AND id = ?',
        [input.title, input.note ?? null, input.dueOffsetDays, this.actorId, nowIso, this.projectId, taskId],
      );
    }, this.operation('task', taskId, 'update', await this.rowVersion('task', taskId), {
      title: input.title,
      ...(input.note !== undefined ? { notes: input.note } : {}),
    }));
  }

  async setTaskDone(taskId: string, done: boolean): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        'UPDATE moving_tasks SET status = ?, completed_at = ?, updated_by = ?, updated_at = ? WHERE project_id = ? AND id = ?',
        [done ? 'completed' : 'pending', done ? nowIso : null, this.actorId, nowIso, this.projectId, taskId],
      );
    }, this.operation('task', taskId, done ? 'complete' : 'set_status', await this.rowVersion('task', taskId),
      done ? {} : { status: 'pending' }));
  }

  async deleteTask(taskId: string): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        'UPDATE moving_tasks SET deleted_at = ?, updated_by = ?, updated_at = ? WHERE project_id = ? AND id = ?',
        [nowIso, this.actorId, nowIso, this.projectId, taskId],
      );
    }, this.operation('task', taskId, 'soft_delete', await this.rowVersion('task', taskId), {}));
  }

  async setMovingDate(dateMs: number | null): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    const date = dateMs === null ? null : new Date(dateMs).toISOString().slice(0, 10);
    await this.commit(async tx => {
      await tx.execute(
        'UPDATE moving_projects SET moving_date = ?, updated_at = ? WHERE id = ?',
        [date, nowIso, this.projectId],
      );
    });
  }

  async addStoragePhoto(imageUri: string, title?: string): Promise<string> {
    const photo: StoragePhoto = {
      id: this.generateId(),
      imageUri,
      ...(title !== undefined ? { title } : {}),
      createdAt: this.now(),
    };
    const next = [...this.snapshot.state.storagePhotos, photo];
    await this.storage.setItem(storagePhotoKey(this.projectId), JSON.stringify(next));
    await this.refresh();
    return photo.id;
  }

  async deleteStoragePhoto(photoId: string): Promise<void> {
    const next = this.snapshot.state.storagePhotos.filter(photo => photo.id !== photoId);
    await this.storage.setItem(storagePhotoKey(this.projectId), JSON.stringify(next));
    await this.refresh();
  }

  async setBoxMarker(boxId: string, photoId: string, rect: MarkerRect): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        'UPDATE moving_boxes SET storage_photo_id = ?, marker_rect = ?, updated_at = ? WHERE project_id = ? AND id = ?',
        [photoId, JSON.stringify(rect), nowIso, this.projectId, boxId],
      );
    });
  }

  async clearBoxMarker(boxId: string): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    await this.commit(async tx => {
      await tx.execute(
        'UPDATE moving_boxes SET storage_photo_id = NULL, marker_rect = NULL, updated_at = ? WHERE project_id = ? AND id = ?',
        [nowIso, this.projectId, boxId],
      );
    });
  }
}

const ProjectDataContext = createContext<{
  controller: ProjectDataController;
  snapshot: ProjectDataSnapshot;
} | null>(null);

export function ProjectDataProvider({
  projectId,
  actorId,
  onLocalCommit,
  children,
}: {
  projectId: string;
  actorId: string;
  onLocalCommit?: () => void;
  children: ReactNode;
}) {
  const controllerRef = useRef<ProjectDataController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new ProjectDataController({ projectId, actorId, onLocalCommit });
  }
  const controller = controllerRef.current;

  const [snapshot, setSnapshot] = useState<ProjectDataSnapshot>(() => controller.getState());

  useEffect(() => {
    const unsubscribe = controller.subscribe(() => setSnapshot(controller.getState()));
    void controller.load();
    return () => {
      unsubscribe();
      void controller.dispose();
    };
  }, [controller]);

  const value = useMemo(() => ({ controller, snapshot }), [controller, snapshot]);
  return <ProjectDataContext.Provider value={value}>{children}</ProjectDataContext.Provider>;
}

export function useProjectData(): {
  controller: ProjectDataController;
  snapshot: ProjectDataSnapshot;
} {
  const value = useContext(ProjectDataContext);
  if (!value) {
    throw new Error('useProjectData must be used within ProjectDataProvider');
  }
  return value;
}
