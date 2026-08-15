import {
  buildLegacyImportPlan,
  executeLegacyImport,
  type LegacyImportReceipt,
  type LegacyImportRepositoryTransaction,
  type LegacyImportRepositories,
} from './legacy-import';

import type { MemoryState } from '@/types/memory';
import type { MovingState } from '@/types/moving';

const moving: MovingState = {
  schemaVersion: 4,
  movingDate: 1_786_665_600_000,
  rooms: [
    { id: 'source-kitchen', name: '旧厨房', color: '#BFDCCB', kind: 'source', order: 0 },
    { id: 'destination-kitchen', name: '新厨房', color: '#BCD7E8', kind: 'destination', order: 0 },
  ],
  boxes: [{
    id: 'box-1',
    code: 'BOX-001',
    name: '餐具',
    sourceRoomId: 'source-kitchen',
    destinationRoomId: 'destination-kitchen',
    status: '已装箱',
    note: '易碎',
    storagePhotoId: 'storage-photo-1',
    createdAt: 1_786_646_400_000,
    updatedAt: 1_786_646_401_000,
  }],
  items: [{
    id: 'item-1', name: '盘子', quantity: 6, originalLocation: '旧厨房', destinationLocation: '新厨房',
    boxId: 'box-1', action: '带走', status: '已装箱', note: '白色',
    createdAt: 1_786_646_402_000, updatedAt: 1_786_646_403_000,
  }],
  tasks: [{
    id: 'task-1', title: '预约搬家公司', dueOffsetDays: -7, done: false, note: '上午',
    createdAt: 1_786_646_404_000, updatedAt: 1_786_646_405_000,
  }],
  storagePhotos: [{
    id: 'storage-photo-1', imageUri: 'file:///documents/cabinet.jpg', title: '橱柜', createdAt: 1_786_646_406_000,
  }],
};

const memory: MemoryState = {
  schemaVersion: 1,
  houses: [{
    id: 'house-1', name: '老房子', coverColor: '#eee', note: '有阳台', order: 0,
    createdAt: 1_786_646_407_000, updatedAt: 1_786_646_408_000,
  }],
  rooms: [{
    id: 'memory-room-1', houseId: 'house-1', name: '客厅', color: '#fff', note: '朝南', order: 0,
    walls: [{ id: 'wall-1', x1: 0, y1: 0, x2: 100, y2: 0 }],
    photos: [{
      id: 'memory-photo-1', wallId: 'wall-1', t: 0.5, imageUri: 'file:///documents/living-room.jpg',
      caption: '午后', createdAt: 1_786_646_409_000,
    }],
    createdAt: 1_786_646_410_000, updatedAt: 1_786_646_411_000,
  }],
};

class AtomicImportRepositories implements LegacyImportRepositories {
  readonly entities = new Map<string, unknown>();
  readonly receipts = new Map<string, LegacyImportReceipt>();
  failNextEntityId: string | undefined;

  async getReceipt(sourceStorageVersion: string) {
    return this.receipts.get(sourceStorageVersion) ?? null;
  }

  async saveReceipt(receipt: LegacyImportReceipt) {
    this.receipts.set(receipt.sourceStorageVersion, receipt);
  }

  async transaction(work: (transaction: LegacyImportRepositoryTransaction) => Promise<void>) {
    const staged = new Map(this.entities);
    await work({
      upsert: async entity => {
        if (entity.id === this.failNextEntityId) {
          this.failNextEntityId = undefined;
          throw new Error('injected repository failure');
        }
        staged.set(entity.id, entity);
      },
    });
    this.entities.clear();
    staged.forEach((value, key) => this.entities.set(key, value));
  }
}

describe('legacy local-data import', () => {
  it('builds a deterministic plan with rooms before referenced boxes and keeps local photo paths', () => {
    const plan = buildLegacyImportPlan(moving, memory);

    expect(plan.sourceStorageVersion).toBe('banjiatino-moving-state-v1@4|banjiatino-memory-state-v1@1');
    expect(plan.entities.map(entity => entity.sourceKey)).toEqual([
      'legacy:room:source-kitchen',
      'legacy:room:destination-kitchen',
      'legacy:box:box-1',
      'legacy:item:item-1',
      'legacy:task:task-1',
      'legacy:storage_photo:storage-photo-1',
      'legacy:memory_house:house-1',
      'legacy:memory_room:memory-room-1',
      'legacy:memory_wall:wall-1',
      'legacy:memory_photo:memory-photo-1',
    ]);
    expect(plan.entities.map(entity => entity.id)).toEqual([
      'c5b73af8-fc91-55aa-ba89-9945a99e8931',
      '07730deb-b664-567a-bf5d-d6b86e7b93a3',
      'ea42617c-9748-5b75-addb-8f96a42d8c61',
      '3a31d6c5-1a2c-5dd9-ba0b-14ad16be768a',
      '16b71dbc-3397-56b1-bd41-cb7717dcd163',
      'c7310a2f-b4a3-5a50-8cec-3aa2420fa30c',
      '71de34b8-ca17-5fd3-8e98-79ca1543374a',
      '6abc56e4-1dd3-587e-9086-9595eec3ee1b',
      '5ad3f366-2026-52c5-a0f3-a786f7886f11',
      '18fec5b9-6366-59f9-b809-2b21a2d763c1',
    ]);
    expect(plan.entities[2]).toMatchObject({
      references: ['c5b73af8-fc91-55aa-ba89-9945a99e8931', '07730deb-b664-567a-bf5d-d6b86e7b93a3'],
      payload: { notes: '易碎', status: '已装箱' },
    });
    expect(plan.entities[4]).toMatchObject({
      payload: { dueOffsetDays: -7, movingDate: 1_786_665_600_000, notes: '上午' },
    });
    expect(plan.entities[5]).toMatchObject({ payload: { localPath: 'file:///documents/cabinet.jpg' } });
    expect(plan.entities[9]).toMatchObject({ payload: { localPath: 'file:///documents/living-room.jpg' } });
    expect(buildLegacyImportPlan(moving, memory)).toEqual(plan);
  });

  it('records a completed receipt once and makes retries idempotent', async () => {
    const repositories = new AtomicImportRepositories();
    const plan = buildLegacyImportPlan(moving, memory);

    const first = await executeLegacyImport(plan, repositories);
    const second = await executeLegacyImport(plan, repositories);

    expect(first).toEqual({
      sourceStorageVersion: 'banjiatino-moving-state-v1@4|banjiatino-memory-state-v1@1',
      status: 'completed', attemptCount: 1, importedEntityIds: plan.entities.map(entity => entity.id),
    });
    expect(second).toEqual(first);
    expect([...repositories.entities.keys()]).toEqual(plan.entities.map(entity => entity.id));
    expect(repositories.receipts.get(plan.sourceStorageVersion)).toEqual(first);
  });

  it('keeps legacy data retryable after a transaction failure and completes on the next attempt', async () => {
    const repositories = new AtomicImportRepositories();
    const plan = buildLegacyImportPlan(moving, memory);
    repositories.failNextEntityId = 'ea42617c-9748-5b75-addb-8f96a42d8c61';

    const failed = await executeLegacyImport(plan, repositories);
    const retried = await executeLegacyImport(plan, repositories);

    expect(failed).toEqual({
      sourceStorageVersion: 'banjiatino-moving-state-v1@4|banjiatino-memory-state-v1@1',
      status: 'retryable', attemptCount: 1, importedEntityIds: [], lastError: 'injected repository failure',
    });
    expect(retried).toMatchObject({ status: 'completed', attemptCount: 2 });
    expect([...repositories.entities.keys()]).toEqual(plan.entities.map(entity => entity.id));
  });
});
