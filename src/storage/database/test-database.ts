import { applyDatabaseMigrations } from './migrations';
import type {
  DatabaseConnection,
  DatabaseQueryResult,
  DatabaseTransaction,
  DatabaseValue,
} from './connection';

type NodeStatement = {
  all: (...values: DatabaseValue[]) => Array<Record<string, DatabaseValue>>;
  run: (...values: DatabaseValue[]) => { changes: number; lastInsertRowid: number | bigint };
};

type NodeDatabase = {
  close: () => void;
  exec: (sql: string) => void;
  prepare: (sql: string) => NodeStatement;
};

type NodeSqlite = { DatabaseSync: new (location: string) => NodeDatabase };

function loadNodeSqlite(): NodeSqlite {
  return require('node:sqlite') as NodeSqlite;
}

export class TestDatabase implements DatabaseConnection {
  private readonly database: NodeDatabase;
  private nextOutboxInsertFailure: Error | undefined;

  constructor() {
    const { DatabaseSync } = loadNodeSqlite();
    this.database = new DatabaseSync(':memory:');
    this.database.exec('PRAGMA foreign_keys = ON');
  }

  failNextOutboxInsert(error: Error): void {
    this.nextOutboxInsertFailure = error;
  }

  async execute(sql: string, values: DatabaseValue[] = []): Promise<DatabaseQueryResult> {
    if (/^\s*INSERT\s+INTO\s+outbox\b/i.test(sql) && this.nextOutboxInsertFailure) {
      const error = this.nextOutboxInsertFailure;
      this.nextOutboxInsertFailure = undefined;
      throw error;
    }

    const statement = this.database.prepare(sql);
    if (/^\s*(SELECT|PRAGMA)/i.test(sql)) {
      return { rows: statement.all(...values), rowsAffected: 0 };
    }

    const result = statement.run(...values);
    return { rows: [], rowsAffected: result.changes, insertId: Number(result.lastInsertRowid) };
  }

  async transaction<T>(work: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = await work({
        execute: this.execute.bind(this),
        abort: error => {
          throw error;
        },
      });
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  async scalar<T extends DatabaseValue>(sql: string, values: DatabaseValue[] = []): Promise<T> {
    const result = await this.execute(sql, values);
    return result.rows[0]?.value as T;
  }

  close(): void {
    this.database.close();
  }
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const database = new TestDatabase();
  await applyDatabaseMigrations(database);
  return database;
}

export async function closeTestDatabase(database: TestDatabase): Promise<void> {
  database.close();
}
