import * as fs from 'fs';
import * as path from 'path';
import { Browser, BrowserContext, Page } from 'playwright';
import {
  InstagramProfileScraper,
  parseInstagramUrl,
  maskSessionId,
  resolveInstagramSessionIdFromEnv
} from '../agents/instagram-profile';
import { launchStealthBrowser } from '../agents/google-search/stealth-bootstrap';
import {
  generateSessionFingerprint,
  injectFingerprint,
  resolveTimezone,
  GeneratedFingerprint
} from '../agents/google-search/stealth-profile';
import { FALLBACK_CHANNELS } from '../engine/browser-config';
import { loadSessionState, saveSessionState, StorageStateData } from '../engine/session-manager';

interface CliOptions {
  profileUrl: string;
  debug: boolean;
  sessionId: string | null;
}

interface FailureDebugInfo {
  normalizedUrl: string;
  currentUrl: string;
  pageTitle: string;
  selectors: {
    headerSectionVisible: boolean;
    closeDialogVisible: boolean;
    loginUsernameVisible: boolean;
    loginPasswordVisible: boolean;
  };
  snippet: string;
  screenshotPath: string;
  htmlPath: string;
  capturedAt: string;
}

const OUTPUT_DIR = path.join(process.cwd(), 'output');
const DEBUG_DIR = path.join(OUTPUT_DIR, 'debug');

function parseArgs(args: string[]): CliOptions {
  let profileUrl = '';
  let debug = false;
  let sessionId: string | null = null;

  for (const arg of args) {
    if (arg === '--debug') {
      debug = true;
      continue;
    }

    if (arg.startsWith('--sessionid=')) {
      sessionId = arg.substring('--sessionid='.length).trim() || null;
      continue;
    }

    if (!arg.startsWith('--') && !profileUrl) {
      profileUrl = arg;
    }
  }

  if (!profileUrl) {
    throw new Error('USAGE: npm run test:instagram:url -- "https://www.instagram.com/usuario/" [--debug] [--sessionid=SEU_ID]');
  }

  return { profileUrl, debug, sessionId };
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function launchInstagramContext(fingerprint: GeneratedFingerprint): Promise<{
  browser: Browser;
  context: BrowserContext;
  channelUsed: string;
}> {
  let lastError: Error | null = null;

  for (const channel of FALLBACK_CHANNELS) {
    try {
      const browser = await launchStealthBrowser(channel);
      const savedInstagramState = await loadSessionState('instagram');

      const context = await browser.newContext({
        viewport: null,
        colorScheme: 'light',
        locale: fingerprint.fingerprint.navigator.language,
        timezoneId: resolveTimezone(fingerprint),
        userAgent: fingerprint.fingerprint.navigator.userAgent,
        storageState: savedInstagramState ? JSON.parse(JSON.stringify(savedInstagramState)) : undefined,
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
        offline: false
      });

      await injectFingerprint(context, fingerprint);

      return {
        browser,
        context,
        channelUsed: channel
      };
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError || new Error('Nenhum navegador compativel encontrado.');
}

async function captureFailureDebug(page: Page, normalizedUrl: string): Promise<FailureDebugInfo> {
  ensureDir(DEBUG_DIR);

  const timestamp = Date.now();
  const screenshotPath = path.join(DEBUG_DIR, `instagram-profile-fail-${timestamp}.png`);
  const htmlPath = path.join(DEBUG_DIR, `instagram-profile-fail-${timestamp}.html`);

  const selectors = {
    headerSectionVisible: await page.locator('header section').first().isVisible({ timeout: 1000 }).catch(() => false),
    closeDialogVisible: await page
      .locator('button[aria-label="Fechar"], button[aria-label="Close"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false),
    loginUsernameVisible: await page.locator('input[name="username"]').first().isVisible({ timeout: 1000 }).catch(() => false),
    loginPasswordVisible: await page.locator('input[name="password"]').first().isVisible({ timeout: 1000 }).catch(() => false)
  };

  const pageTitle = await page.title().catch(() => '');
  const html = await page.content().catch(() => '');
  const snippet = await page
    .evaluate(() => (document.body?.innerText || '').slice(0, 1200))
    .catch(() => '');

  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  fs.writeFileSync(htmlPath, html, 'utf-8');

  return {
    normalizedUrl,
    currentUrl: page.url(),
    pageTitle,
    selectors,
    snippet,
    screenshotPath,
    htmlPath,
    capturedAt: new Date().toISOString()
  };
}

async function detectSessionIdFromContext(context: BrowserContext): Promise<string | null> {
  try {
    const cookies = await context.cookies('https://www.instagram.com');
    const sessionCookie = cookies.find(cookie => cookie.name === 'sessionid');
    const value = sessionCookie?.value?.trim() || '';
    return value || null;
  } catch {
    return null;
  }
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.sessionId) {
    process.env.INSTAGRAM_SESSIONID = options.sessionId;
  }

  const urlInfo = parseInstagramUrl(options.profileUrl);

  if (!urlInfo.isProfile || !urlInfo.normalizedUrl) {
    throw new Error('URL invalida para perfil Instagram. Exemplo: https://www.instagram.com/nasa/');
  }

  ensureDir(OUTPUT_DIR);

  const fingerprint = generateSessionFingerprint();
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  console.log('Teste individual de extracao Instagram');
  console.log(`URL normalizada: ${urlInfo.normalizedUrl}`);
  console.log(`Debug ativo: ${options.debug ? 'sim' : 'nao'}`);

  const resolvedSessionId = resolveInstagramSessionIdFromEnv();
  if (resolvedSessionId) {
    console.log(`INSTAGRAM_SESSIONID detectada: ${maskSessionId(resolvedSessionId)}`);
  } else {
    console.log('INSTAGRAM_SESSIONID nao definida. A deteccao automatica da sessao sera tentada.');
  }

  try {
    const launched = await launchInstagramContext(fingerprint);
    browser = launched.browser;
    context = launched.context;

    console.log(`Canal de browser: ${launched.channelUsed}`);

    const page = await context.newPage();
    const contextSessionId = await detectSessionIdFromContext(context);
    if (contextSessionId) {
      console.log(`Sessionid da sessao atual detectado automaticamente: ${maskSessionId(contextSessionId)}`);
    } else {
      console.log('Nenhum sessionid detectado automaticamente na sessao atual.');
    }

    const scraper = new InstagramProfileScraper();

    const startedAt = Date.now();
    const profile = await scraper.scrapeProfile(page, urlInfo.normalizedUrl);
    const durationMs = Date.now() - startedAt;

    if (profile) {
      const profilePath = path.join(OUTPUT_DIR, `instagram-profile-${profile.username}-${Date.now()}.json`);
      writeJsonFile(profilePath, profile);

      console.log('Extracao concluida com sucesso.');
      console.log(`Tempo: ${durationMs}ms`);
      console.log(`Arquivo: ${profilePath}`);
      console.log(JSON.stringify(profile, null, 2));
      return;
    }

    console.log('Extracao retornou nulo. Capturando diagnostico...');
    const failure = await captureFailureDebug(page, urlInfo.normalizedUrl);
    const failPath = path.join(DEBUG_DIR, `instagram-profile-fail-${Date.now()}.json`);

    writeJsonFile(failPath, failure);

    console.log(`Diagnostico salvo em: ${failPath}`);
    console.log(`Screenshot: ${failure.screenshotPath}`);
    console.log(`HTML: ${failure.htmlPath}`);

    if (!options.debug) {
      console.log('Dica: rode com --debug para logs mais detalhados do Playwright (DEBUG=pw:api).');
    }

    process.exitCode = 2;
  } finally {
    if (context) {
      const state = await context.storageState() as StorageStateData;
      await saveSessionState('instagram', state);
      await context.close();
    }

    if (browser) {
      await browser.close();
    }
  }
}

run().catch(error => {
  const err = error as Error;
  console.error('Falha no teste individual de Instagram:', err.message);
  process.exit(1);
});
