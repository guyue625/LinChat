type ChatSnapshot<TSession> = {
  sessions: TSession[];
  currentSessionIndex: number;
  lastInput: string;
};

type MeaningfulSession = {
  messages: unknown[];
  topic: string;
  topicManuallyEdited?: boolean;
  mask?: { name?: string };
};

export function normalizeSessionIndex(sessions: unknown[], index: number) {
  if (sessions.length === 0) return 0;
  if (index < 0 || index >= sessions.length) return 0;
  return index;
}

export function isMeaningfulSession(
  session: MeaningfulSession,
  defaultTopic: string,
) {
  if (session.messages.length > 0) return true;
  if (session.topicManuallyEdited) return true;
  if (
    session.topic &&
    session.topic !== defaultTopic &&
    session.topic !== session.mask?.name
  ) {
    return true;
  }
  return false;
}

export function cloneChatSnapshot<TSession>(
  state: ChatSnapshot<TSession>,
): ChatSnapshot<TSession> {
  return {
    sessions: JSON.parse(JSON.stringify(state.sessions)) as TSession[],
    currentSessionIndex: state.currentSessionIndex,
    lastInput: state.lastInput ?? "",
  };
}

export function createEmptyChatSnapshot<TSession>(
  createSession: () => TSession,
): ChatSnapshot<TSession> {
  return {
    sessions: [createSession()],
    currentSessionIndex: 0,
    lastInput: "",
  };
}

export function hydrateChatWorkspace<TSession>(
  snapshot:
    | {
        sessions?: unknown[];
        currentSessionIndex?: number;
        lastInput?: string;
      }
    | null
    | undefined,
  createSession: () => TSession,
): ChatSnapshot<TSession> {
  const sessions =
    snapshot?.sessions && snapshot.sessions.length > 0
      ? (snapshot.sessions as TSession[])
      : [createSession()];

  return {
    sessions,
    currentSessionIndex: normalizeSessionIndex(
      sessions,
      snapshot?.currentSessionIndex ?? 0,
    ),
    lastInput: snapshot?.lastInput ?? "",
  };
}
