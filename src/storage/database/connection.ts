import type { DB, QueryResult, Scalar } from '@op-engineering/op-sqlite';

import { applyDatabaseMigrations } from './migrations';

export type DatabaseValue = Scalar;
export type DatabaseQueryResult = Pick<QueryResult, 'rows' | 'rowsAffected' | 'insertId'>;

export type DatabaseTransaction = {
  execute: (sql: string, values?: DatabaseValue[]) => Promise<DatabaseQueryResult>;
  abort: (error: Error) => never;
};

export type DatabaseConnection = {
  execute: (sql: string, values?: DatabaseValue[]) => Promise<DatabaseQueryResult>;
  transaction: <T>(work: (tx: DatabaseTransaction) => Promise<T>) => Promise<T>;
};

type ProjectListener = () => void;

let configuredDatabase: DatabaseConnection | undefined;
let initializedDatabase: Promise<DatabaseConnection> | undefined;
const projectListeners = new Map<string, Set<ProjectListener>>();

function createTransaction(execute: DatabaseTransaction['execute']): DatabaseTransaction {
  return {
    execute,
    abort: error => {
      throw error;
    },
  };
}

function createNativeDatabase(): DatabaseConnection {
  const { open } = require('@op-engineering/op-sqlite') as {
    open: (options: { name: string }) => DB;
  };
  const database = open({ name: 'banjiatino.sqlite' });

  return {
    execute: (sql, values) => database.execute(sql, values),
    transaction: async work => {
      let result: unknown;
      await database.transaction(async nativeTransaction => {
        result = await work(createTransaction(nativeTransaction.execute));
      });
      return result as Awaited<ReturnType<typeof work>>;
    },
  };
}

async function getDatabase(): Promise<DatabaseConnection> {
  if (configuredDatabase) return configuredDatabase;
  if (!initializedDatabase) {
    initializedDatabase = (async () => {
      const database = createNativeDatabase();
      await applyDatabaseMigrations(database);
      return database;
    })();
  }
  return initializedDatabase;
}

export async function withDatabaseTransaction<T>(
  work: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return (await getDatabase()).transaction(work);
}

export async function executeDatabaseQuery(
  sql: string,
  values?: DatabaseValue[],
): Promise<DatabaseQueryResult> {
  return (await getDatabase()).execute(sql, values);
}

export function subscribeToProject(projectId: string, listener: ProjectListener): () => void {
  const listeners = projectListeners.get(projectId) ?? new Set<ProjectListener>();
  listeners.add(listener);
  projectListeners.set(projectId, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) projectListeners.delete(projectId);
  };
}

export function notifyProjectCommitted(projectId: string): void {
  for (const listener of projectListeners.get(projectId) ?? []) {
    try {
      listener();
    } catch {
      // Notifications are post-commit observations and cannot undo a committed mutation.
    }
  }
}

export function setDatabaseForTesting(database: DatabaseConnection): void {
  configuredDatabase = database;
  initializedDatabase = undefined;
}

export function resetDatabaseForTesting(): void {
  configuredDatabase = undefined;
  initializedDatabase = undefined;
  projectListeners.clear();
}
