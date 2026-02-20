import { BrowserContext } from 'playwright';
import { FingerprintGenerator, Fingerprint } from 'fingerprint-generator';
import { FingerprintInjector } from 'fingerprint-injector';

const generator = new FingerprintGenerator({
  browsers: [{ name: 'chrome', minVersion: 120 }],
  operatingSystems: ['windows'],
  devices: ['desktop'],
  locales: ['pt-BR']
});

export interface GeneratedFingerprint {
  fingerprint: Fingerprint;
  headers: Record<string, string>;
}

export function generateSessionFingerprint(): GeneratedFingerprint {
  const result = generator.getFingerprint();

  return {
    fingerprint: result.fingerprint,
    headers: result.headers
  };
}

export async function injectFingerprint(
  context: BrowserContext,
  fingerprint: GeneratedFingerprint
): Promise<void> {
  const injector = new FingerprintInjector();
  await injector.attachFingerprintToPlaywright(context, fingerprint);
}

export function resolveTimezone(fingerprint: GeneratedFingerprint): string {
  const language = fingerprint.fingerprint.navigator.language;
  if (language.startsWith('pt-BR') || language.startsWith('pt')) {
    return 'America/Sao_Paulo';
  }
  if (language.startsWith('en-US')) {
    return 'America/New_York';
  }
  if (language.startsWith('en-GB')) {
    return 'Europe/London';
  }
  return 'America/Sao_Paulo';
}
