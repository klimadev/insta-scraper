import * as fs from 'fs';
import * as path from 'path';
import { launchStealthBrowser } from '../agents/google-search/stealth-bootstrap';
import { generateSessionFingerprint, injectFingerprint, resolveTimezone, GeneratedFingerprint } from '../agents/google-search/stealth-profile';
import { FALLBACK_CHANNELS } from '../engine/browser-config';
import { loadSessionState, saveSessionState, StorageStateData } from '../engine/session-manager';
import { Browser } from 'playwright';

async function run(): Promise<void> {
  const fingerprint: GeneratedFingerprint = generateSessionFingerprint();
  let browser: Browser | null = null;

  console.log('Fingerprint gerado:');
  console.log(`  UA: ${fingerprint.fingerprint.navigator.userAgent}`);
  console.log(`  Locale: ${fingerprint.fingerprint.navigator.language}`);
  console.log(`  Screen: ${fingerprint.fingerprint.screen.width}x${fingerprint.fingerprint.screen.height}`);

  for (const channel of FALLBACK_CHANNELS) {
    try {
      browser = await launchStealthBrowser(channel);
      break;
    } catch {
      continue;
    }
  }

  if (!browser) {
    throw new Error('Nenhum navegador compativel encontrado para o teste stealth.');
  }

  const savedState = await loadSessionState('google');

  const context = await browser.newContext({
    viewport: null,
    colorScheme: 'light',
    locale: fingerprint.fingerprint.navigator.language,
    timezoneId: resolveTimezone(fingerprint),
    userAgent: fingerprint.fingerprint.navigator.userAgent,
    storageState: savedState ? JSON.parse(JSON.stringify(savedState)) : undefined
  });

  await injectFingerprint(context, fingerprint);

  const page = await context.newPage();
  await page.goto('https://bot.sannysoft.com', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(4000);

  const screenshotDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const screenshotPath = path.join(screenshotDir, `sannysoft-stealth-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log(`Screenshot salvo em: ${screenshotPath}`);

  const state = await context.storageState() as StorageStateData;
  await saveSessionState('google', state);

  await context.close();
  await browser.close();
}

run().catch(async error => {
  console.error('Falha no teste de stealth:', error);
  process.exit(1);
});
