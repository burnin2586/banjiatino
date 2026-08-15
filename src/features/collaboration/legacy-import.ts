import type { MovingState } from '@/types/moving';

export const LEGACY_MOVING_STORAGE_KEY = 'banjiatino-moving-state-v1';

export type LegacyImportEntityType =
  | 'room'
  | 'box'
  | 'item'
  | 'task'
  | 'storage_photo';

export type LegacyImportEntity = {
  id: string;
  type: LegacyImportEntityType;
  legacyId: string;
  sourceKey: string;
  references: string[];
  payload: Record<string, unknown>;
};

export type LegacyImportPlan = {
  sourceStorageVersion: string;
  entities: LegacyImportEntity[];
};

export type LegacyImportReceipt = {
  sourceStorageVersion: string;
  status: 'completed' | 'retryable';
  attemptCount: number;
  importedEntityIds: string[];
  lastError?: string;
};

export type LegacyImportRepositoryTransaction = {
  upsert: (entity: LegacyImportEntity) => Promise<void>;
};

export type LegacyImportRepositories = {
  getReceipt: (sourceStorageVersion: string) => Promise<LegacyImportReceipt | null>;
  saveReceipt: (receipt: LegacyImportReceipt) => Promise<void>;
  transaction: (work: (transaction: LegacyImportRepositoryTransaction) => Promise<void>) => Promise<void>;
};

function legacySourceKey(type: LegacyImportEntityType, id: string): string {
  return `legacy:${type}:${id}`;
}

const LEGACY_UUID_NAMESPACE = [
  0x6b, 0xa7, 0xb8, 0x11, 0x9d, 0xad, 0x11, 0xd1,
  0x80, 0xb4, 0x00, 0xc0, 0x4f, 0xd4, 0x30, 0xc8,
];

function rotateLeft(value: number, amount: number): number {
  return ((value << amount) | (value >>> (32 - amount))) >>> 0;
}

function utf8Bytes(value: string): number[] {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.charCodeAt(index));
    }
  }
  return bytes;
}

function sha1(bytes: number[]): number[] {
  const padded = [...bytes, 0x80];
  while (padded.length % 64 !== 56) padded.push(0);

  const bitLength = bytes.length * 8;
  padded.push(0, 0, 0, 0, (bitLength >>> 24) & 0xff, (bitLength >>> 16) & 0xff,
    (bitLength >>> 8) & 0xff, bitLength & 0xff);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = new Array<number>(80).fill(0);
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] = ((padded[start] << 24) | (padded[start + 1] << 16)
        | (padded[start + 2] << 8) | padded[start + 3]) >>> 0;
    }
    for (let index = 16; index < 80; index += 1) {
      words[index] = rotateLeft(words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16], 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let index = 0; index < 80; index += 1) {
      const f = index < 20
        ? (b & c) | ((~b) & d)
        : index < 40
          ? b ^ c ^ d
          : index < 60
            ? (b & c) | (b & d) | (c & d)
            : b ^ c ^ d;
      const k = index < 20 ? 0x5a827999 : index < 40 ? 0x6ed9eba1 : index < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const next = (rotateLeft(a, 5) + f + e + k + words[index]) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = next;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].flatMap(value => [
    (value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff,
  ]);
}

function legacyEntityId(type: LegacyImportEntityType, id: string): string {
  const sourceKey = legacySourceKey(type, id);
  const uuid = sha1([...LEGACY_UUID_NAMESPACE, ...utf8Bytes(sourceKey)]).slice(0, 16);
  uuid[6] = (uuid[6] & 0x0f) | 0x50;
  uuid[8] = (uuid[8] & 0x3f) | 0x80;
  const hex = uuid.map(value => value.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function addEntity(
  entities: LegacyImportEntity[],
  type: LegacyImportEntityType,
  id: string,
  payload: Record<string, unknown>,
  references: string[] = [],
): void {
  entities.push({
    id: legacyEntityId(type, id),
    type,
    legacyId: id,
    sourceKey: legacySourceKey(type, id),
    references,
    payload,
  });
}

/**
 * Translates existing AsyncStorage state into a deterministic, side-effect-free import plan.
 * The legacy identifiers are deliberately namespaced so a retry addresses the same local rows.
 */
export function buildLegacyImportPlan(moving: MovingState): LegacyImportPlan {
  const entities: LegacyImportEntity[] = [];

  for (const room of moving.rooms) {
    addEntity(entities, 'room', room.id, {
      name: room.name,
      color: room.color,
      roomKind: room.kind,
      order: room.order,
    });
  }

  for (const box of moving.boxes) {
    addEntity(
      entities,
      'box',
      box.id,
      {
        code: box.code,
        name: box.name,
        notes: box.note,
        status: box.status,
        storagePhotoId: box.storagePhotoId ? legacyEntityId('storage_photo', box.storagePhotoId) : null,
        markerRect: box.markerRect ?? null,
        createdAt: box.createdAt,
        updatedAt: box.updatedAt,
      },
      [legacyEntityId('room', box.sourceRoomId), legacyEntityId('room', box.destinationRoomId)],
    );
  }

  for (const item of moving.items) {
    addEntity(
      entities,
      'item',
      item.id,
      {
        name: item.name,
        quantity: item.quantity,
        originalLocation: item.originalLocation,
        destinationLocation: item.destinationLocation,
        action: item.action,
        status: item.status,
        notes: item.note,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
      item.boxId ? [legacyEntityId('box', item.boxId)] : [],
    );
  }

  for (const task of moving.tasks) {
    addEntity(entities, 'task', task.id, {
      title: task.title,
      dueOffsetDays: task.dueOffsetDays,
      movingDate: moving.movingDate,
      done: task.done,
      notes: task.note,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
  }

  for (const photo of moving.storagePhotos) {
    addEntity(entities, 'storage_photo', photo.id, {
      localPath: photo.imageUri,
      title: photo.title ?? null,
      createdAt: photo.createdAt,
    });
  }

  return {
    sourceStorageVersion: `${LEGACY_MOVING_STORAGE_KEY}@${moving.schemaVersion}`,
    entities,
  };
}

/**
 * Applies a plan through the local repository transaction boundary. Receipts make a completed
 * import a no-op, while a rolled-back failure remains visible and can be retried safely.
 */
export async function executeLegacyImport(
  plan: LegacyImportPlan,
  repositories: LegacyImportRepositories,
): Promise<LegacyImportReceipt> {
  const previous = await repositories.getReceipt(plan.sourceStorageVersion);
  if (previous?.status === 'completed') return previous;

  const attemptCount = (previous?.attemptCount ?? 0) + 1;
  try {
    await repositories.transaction(async transaction => {
      for (const entity of plan.entities) {
        await transaction.upsert(entity);
      }
    });

    const receipt: LegacyImportReceipt = {
      sourceStorageVersion: plan.sourceStorageVersion,
      status: 'completed',
      attemptCount,
      importedEntityIds: plan.entities.map(entity => entity.id),
    };
    await repositories.saveReceipt(receipt);
    return receipt;
  } catch (error) {
    const receipt: LegacyImportReceipt = {
      sourceStorageVersion: plan.sourceStorageVersion,
      status: 'retryable',
      attemptCount,
      importedEntityIds: [],
      lastError: error instanceof Error ? error.message : String(error),
    };
    await repositories.saveReceipt(receipt);
    return receipt;
  }
}
