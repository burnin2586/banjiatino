import type { InvitationFailureCode } from './invitation-errors';
import { classifyInvitationError } from './invitation-errors';

export type JoinFlowPorts = {
  ensureSession: () => Promise<unknown>;
  hasDisplayName: () => Promise<boolean>;
  acceptInvitation: (token: string, displayName?: string) => Promise<{ projectId: string }>;
  fetchProjectName: (projectId: string) => Promise<string>;
  saveCachedProject: (projectId: string) => Promise<void>;
};

export type JoinFlowInput = {
  token: string;
  displayName?: string;
};

export type JoinFlowOutcome =
  | { status: 'joined'; projectId: string; projectName: string }
  | { status: 'needName' }
  | { status: 'failed'; code: InvitationFailureCode };

/**
 * Shared acceptance flow for both the Universal Link join screen and manual invite-code
 * entry: ensure an anonymous session, require a display name for fresh joiners, accept the
 * invitation, preview the project, and cache it only after successful acceptance.
 */
export async function joinProjectWithToken(
  ports: JoinFlowPorts,
  input: JoinFlowInput,
): Promise<JoinFlowOutcome> {
  try {
    await ports.ensureSession();

    const hasName = await ports.hasDisplayName().catch(() => true);
    if (!hasName && !input.displayName) {
      return { status: 'needName' };
    }

    const { projectId } = await ports.acceptInvitation(input.token, input.displayName);
    const projectName = await ports.fetchProjectName(projectId).catch(() => '搬家项目');
    await ports.saveCachedProject(projectId);

    return { status: 'joined', projectId, projectName };
  } catch (error) {
    return { status: 'failed', code: classifyInvitationError(error) };
  }
}
