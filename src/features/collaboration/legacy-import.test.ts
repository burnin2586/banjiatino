import {
  buildLegacyImportPlan,
  executeLegacyImport,
  type LegacyImportReceipt,
  type LegacyImportRepositoryTransaction,
  type LegacyImportRepositories,
} from './legacy-import';

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
    const plan = buildLegacyImportPlan(moving);

    expect(plan.sourceStorageVersion).toBe('banjiatino-moving-state-v1@4');
    expect(plan.entities.map(entity => entity.sourceKey)).toEqual([
      'legacy:room:source-kitchen',
      'legacy:room:destination-kitchen',
      'legacy:box:box-1',
      'legacy:item:item-1',
      'legacy:task:task-1',
      'legacy:storage_photo:storage-photo-1',
    ]);
    expect(plan.entities.map(entity => entity.id)).toEqual([
      'c5b73af8-fc91-55aa-ba89-9945a99e8931',
      '07730deb-b664-567a-bf5d-d6b86e7b93a3',
      'ea42617c-9748-5b75-addb-8f96a42d8c61',
      '3a31d6c5-1a2c-5dd9-ba0b-14ad16be768a',
      '16b71dbc-3397-56b1-bd41-cb7717dcd163',
      'c7310a2f-b4a3-5a50-8cec-3aa2420fa30c',
    ]);
    expect(plan.entities[2]).toMatchObject({
      references: ['c5b73af8-fc91-55aa-ba89-9945a99e8931', '07730deb-b664-567a-bf5d-d6b86e7b93a3'],
      payload: { notes: '易碎', status: '已装箱' },
    });
    expect(plan.entities[4]).toMatchObject({
      payload: { dueOffsetDays: -7, movingDate: 1_786_665_600_000, notes: '上午' },
    });
    expect(plan.entities[5]).toMatchObject({ payload: { localPath: 'file:///documents/cabinet.jpg' } });
    expect(buildLegacyImportPlan(moving)).toEqual(plan);
  });

  it('records a completed receipt once and makes retries idempotent', async () => {
    const repositories = new AtomicImportRepositories();
    const plan = buildLegacyImportPlan(moving);

    const first = await executeLegacyImport(plan, repositories);
    const second = await executeLegacyImport(plan, repositories);

    expect(first).toEqual({
      sourceStorageVersion: 'banjiatino-moving-state-v1@4',
      status: 'completed', attemptCount: 1, importedEntityIds: plan.entities.map(entity => entity.id),
    });
    expect(second).toEqual(first);
    expect([...repositories.entities.keys()]).toEqual(plan.entities.map(entity => entity.id));
    expect(repositories.receipts.get(plan.sourceStorageVersion)).toEqual(first);
  });

  it('keeps legacy data retryable after a transaction failure and completes on the next attempt', async () => {
    const repositories = new AtomicImportRepositories();
    const plan = buildLegacyImportPlan(moving);
    repositories.failNextEntityId = 'ea42617c-9748-5b75-addb-8f96a42d8c61';

    const failed = await executeLegacyImport(plan, repositories);
    const retried = await executeLegacyImport(plan, repositories);

    expect(failed).toEqual({
      sourceStorageVersion: 'banjiatino-moving-state-v1@4',
      status: 'retryable', attemptCount: 1, importedEntityIds: [], lastError: 'injected repository failure',
    });
    expect(retried).toMatchObject({ status: 'completed', attemptCount: 2 });
    expect([...repositories.entities.keys()]).toEqual(plan.entities.map(entity => entity.id));
  });
});
