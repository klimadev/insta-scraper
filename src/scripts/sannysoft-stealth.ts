import * as fs from 'fs';
import * as path from 'path';
import { launchStealthBrowser } from '../agents/google-search/stealth-bootstrap';
import { applySessionProfile, pickSessionProfile } from '../agents/google-search/stealth-profile';
import { FALLBACK_CHANNELS } from '../engine/browser-config';
import { Browser } from 'playwright';

async function run(): Promise<void> {
  const profile = pickSessionProfile();
  let browser: Browser | null = null;

  for (const channel of FALLBACK_CHANNELS) {
    try {
      browser = await launchStealthBrowser(channel);
      break;
    } catch {
      continue;
    }
  }

  if (!browser) {
    throw new Error('Nenhum navegador compatível encontrado para o teste stealth.');
  }

  const context = await browser.newContext({
    viewport: null,
    locale: profile.locale,
    timezoneId: profile.timezoneId,
    userAgent: profile.userAgent
  });

  await applySessionProfile(context, profile);

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

  await context.close();
  await browser.close();
}

run().catch(async error => {
  console.error('Falha no teste de stealth:', error);
  process.exit(1);
});
