export function resolveInstagramSessionIdFromEnv(): string | null {
  const value = process.env.INSTAGRAM_SESSIONID;
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('sessionid=')) {
    return trimmed.substring('sessionid='.length);
  }

  return trimmed;
}

export function maskSessionId(sessionId: string): string {
  if (sessionId.length <= 10) {
    return '***';
  }

  return `${sessionId.slice(0, 4)}...${sessionId.slice(-4)}`;
}
