import { BrowserContext } from 'playwright';

interface UserAgentProfile {
  userAgent: string;
  secChUa: string;
  secChUaMobile: string;
  secChUaPlatform: string;
  platform: string;
  locale: string;
  acceptLanguage: string;
  timezoneId: string;
  hardwareConcurrency: number;
}

const USER_AGENT_PROFILES: UserAgentProfile[] = [
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    secChUa: '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
    secChUaMobile: '?0',
    secChUaPlatform: '"Windows"',
    platform: 'Win32',
    locale: 'pt-BR',
    acceptLanguage: 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    timezoneId: 'America/Sao_Paulo',
    hardwareConcurrency: 8
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    secChUa: '"Not(A:Brand";v="24", "Google Chrome";v="132", "Chromium";v="132"',
    secChUaMobile: '?0',
    secChUaPlatform: '"Windows"',
    platform: 'Win32',
    locale: 'pt-BR',
    acceptLanguage: 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    timezoneId: 'America/Sao_Paulo',
    hardwareConcurrency: 12
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    secChUa: '"Not(A:Brand";v="8", "Google Chrome";v="131", "Chromium";v="131"',
    secChUaMobile: '?0',
    secChUaPlatform: '"Windows"',
    platform: 'Win32',
    locale: 'pt-BR',
    acceptLanguage: 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    timezoneId: 'America/Sao_Paulo',
    hardwareConcurrency: 4
  }
];

export function pickSessionProfile(): UserAgentProfile {
  const index = Math.floor(Math.random() * USER_AGENT_PROFILES.length);
  return USER_AGENT_PROFILES[index];
}

export async function applySessionProfile(
  context: BrowserContext,
  profile: UserAgentProfile
): Promise<void> {
  await context.setExtraHTTPHeaders({
    'accept-language': profile.acceptLanguage,
    'sec-ch-ua': profile.secChUa,
    'sec-ch-ua-mobile': profile.secChUaMobile,
    'sec-ch-ua-platform': profile.secChUaPlatform
  });

  await context.addInitScript(({ platform, hardwareConcurrency }) => {
    Object.defineProperty(navigator, 'platform', {
      get: () => platform,
      configurable: true
    });

    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => hardwareConcurrency,
      configurable: true
    });

    if (typeof (window as Window & { Notification?: unknown }).Notification === 'undefined') {
      (window as Window & { Notification: { permission: string; requestPermission: () => Promise<NotificationPermission> } }).Notification = {
        permission: 'default',
        requestPermission: async () => 'default'
      };
    }
  }, {
    platform: profile.platform,
    hardwareConcurrency: profile.hardwareConcurrency
  });
}

export type { UserAgentProfile };
