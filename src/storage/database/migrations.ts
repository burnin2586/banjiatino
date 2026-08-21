import type { DatabaseConnection } from './connection';
import { databaseMigrations } from './schema';

export async function applyDatabaseMigrations(database: DatabaseConnection): Promise<void> {
  const versionResult = await database.execute('PRAGMA user_version');
  const currentVersion = Number(versionResult.rows[0]?.user_version ?? 0);

  for (const migration of databaseMigrations) {
    if (migration.version <= currentVersion) continue;

    await database.transaction(async tx => {
      for (const statement of migration.statements) {
        await tx.execute(statement);
      }
      await tx.execute(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
