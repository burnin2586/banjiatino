import { LegacyImportRepository } from '@/repositories/legacy-import-repository';
import type { MovingState } from '@/types/moving';
import { buildLegacyImportPlan, executeLegacyImport, type LegacyImportReceipt } from './legacy-import';

export type LegacyMovingStateReader = () => Promise<MovingState | null>;

export type LegacyImportStartupOptions = {
  projectId: string;
  projectName: string;
  readLegacyMovingState: LegacyMovingStateReader;
};

/**
 * Runs once per startup before the legacy contexts hand control to the collaboration stack.
 * Legacy AsyncStorage is only ever read; a retryable receipt keeps the old contexts active and
 * the next startup retries the import with the same deterministic identifiers.
 */
export async function runLegacyImportAtStartup(
  options: LegacyImportStartupOptions,
): Promise<LegacyImportReceipt | null> {
  const moving = await options.readLegacyMovingState();
  if (!moving) return null;

  const plan = buildLegacyImportPlan(moving);
  const repository = new LegacyImportRepository(options.projectId);

  const existing = await repository.getReceipt(plan.sourceStorageVersion);
  if (existing?.status === 'completed') return existing;

  await repository.ensureProject(options.projectName, moving.movingDate ?? null);
  return executeLegacyImport(plan, repository);
}
