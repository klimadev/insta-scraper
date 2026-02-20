import * as fs from 'fs';
import * as path from 'path';

export type Platform = 'google' | 'instagram';

export interface StorageStateData {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

const SESSIONS_DIR = path.join(process.cwd(), 'data', 'sessions');
const DEFAULT_TTL_DAYS = 7;

function ensureSessionsDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function getSessionPath(platform: Platform): string {
  return path.join(SESSIONS_DIR, `${platform}-session.json`);
}

function getFingerprintCachePath(): string {
  return path.join(SESSIONS_DIR, 'fingerprint-cache.json');
}

export interface SessionState {
  storageState: StorageStateData;
  createdAt: string;
  fingerprintHash?: string;
}

export interface FingerprintCache {
  hash: string;
  createdAt: string;
  fingerprint: Record<string, unknown>;
}

export async function loadSessionState(platform: Platform): Promise<StorageStateData | null> {
  const sessionPath = getSessionPath(platform);

  if (!fs.existsSync(sessionPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(sessionPath, 'utf-8');
    const session: SessionState = JSON.parse(content);

    if (isSessionExpired(session.createdAt)) {
      await clearSession(platform);
      return null;
    }

    return session.storageState;
  } catch {
    return null;
  }
}

export async function saveSessionState(platform: Platform, state: StorageStateData): Promise<void> {
  ensureSessionsDir();

  const sessionPath = getSessionPath(platform);
  const session: SessionState = {
    storageState: state,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
}

export async function saveFingerprintCache(fingerprint: Record<string, unknown>, hash: string): Promise<void> {
  ensureSessionsDir();

  const cachePath = getFingerprintCachePath();
  const cache: FingerprintCache = {
    hash,
    createdAt: new Date().toISOString(),
    fingerprint
  };

  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

export async function loadFingerprintCache(): Promise<FingerprintCache | null> {
  const cachePath = getFingerprintCachePath();

  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function isSessionExpired(createdAt: string, ttlDays: number = DEFAULT_TTL_DAYS): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > ttlDays;
}

export async function clearSession(platform: Platform): Promise<void> {
  const sessionPath = getSessionPath(platform);

  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
  }
}

export async function clearAllSessions(): Promise<void> {
  for (const platform of ['google', 'instagram'] as Platform[]) {
    await clearSession(platform);
  }

  const cachePath = getFingerprintCachePath();
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
  }
}
