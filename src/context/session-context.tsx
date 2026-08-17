import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  runBootstrap,
  submitOnboarding,
  type AuthIdentity,
  type BootstrapOutcome,
  type BootstrapPorts,
  type OnboardingInput,
} from '@/features/collaboration/bootstrap';
import { createBootstrapPorts } from '@/services/supabase/bootstrap-ports';

export type SessionStatus =
  | 'bootstrapping'
  | 'ready'
  | 'needsOnboarding'
  | 'offlineWithCachedProject'
  | 'offlineWithoutIdentity'
  | 'retryable';

export type SessionContextValue = {
  status: SessionStatus;
  identity: AuthIdentity | null;
  currentProjectId: string | null;
  legacyImportRetryable: boolean;
  lastError: string | null;
  retry: () => void;
  submit: (input: OnboardingInput) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function toSessionState(outcome: BootstrapOutcome): {
  status: SessionStatus;
  identity: AuthIdentity | null;
  currentProjectId: string | null;
  legacyImportRetryable: boolean;
  retryableError: string | null;
} {
  switch (outcome.status) {
    case 'ready':
      return {
        status: 'ready',
        identity: outcome.identity,
        currentProjectId: outcome.projectId,
        legacyImportRetryable: outcome.legacyImportRetryable,
        retryableError: null,
      };
    case 'needsOnboarding':
      return {
        status: 'needsOnboarding',
        identity: null,
        currentProjectId: null,
        legacyImportRetryable: false,
        retryableError: null,
      };
    case 'offlineWithCachedProject':
      return {
        status: 'offlineWithCachedProject',
        identity: null,
        currentProjectId: outcome.projectId,
        legacyImportRetryable: false,
        retryableError: null,
      };
    case 'offlineWithoutIdentity':
      return {
        status: 'offlineWithoutIdentity',
        identity: null,
        currentProjectId: null,
        legacyImportRetryable: false,
        retryableError: null,
      };
    case 'retryable':
      return {
        status: 'retryable',
        identity: null,
        currentProjectId: null,
        legacyImportRetryable: false,
        retryableError: outcome.error,
      };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const portsRef = useRef<BootstrapPorts | null>(null);
  if (!portsRef.current) {
    portsRef.current = createBootstrapPorts();
  }

  const [state, setState] = useState(() => toSessionState({
    status: 'needsOnboarding',
  } as BootstrapOutcome));
  const [bootstrapping, setBootstrapping] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const bootstrap = useCallback(() => {
    setBootstrapping(true);
    void runBootstrap(portsRef.current!)
      .then(outcome => setState(toSessionState(outcome)))
      .catch(error => setState(toSessionState({
        status: 'retryable',
        stage: 'session',
        error: error instanceof Error ? error.message : String(error),
      })))
      .finally(() => setBootstrapping(false));
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const retry = useCallback(() => {
    bootstrap();
  }, [bootstrap]);

  const submit = useCallback(async (input: OnboardingInput) => {
    setSubmitting(true);
    try {
      const outcome = await submitOnboarding(portsRef.current!, input);
      setState(toSessionState(outcome));
    } finally {
      setSubmitting(false);
    }
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    status: bootstrapping ? 'bootstrapping' : state.status,
    identity: state.identity,
    currentProjectId: state.currentProjectId,
    legacyImportRetryable: state.legacyImportRetryable,
    lastError: state.retryableError,
    retry,
    submit,
  }), [bootstrapping, state, retry, submit]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return value;
}
