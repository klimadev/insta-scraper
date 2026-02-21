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
import { toCsvRow } from '../utils/csv';

interface CliOptions {
  profileUrl: string;
  debug: boolean;
  sessionId: string | null;
  raw: boolean;
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
  let raw = false;

  for (const arg of args) {
    if (arg === '--debug') {
      debug = true;
      continue;
    }

    if (arg === '--raw') {
      raw = true;
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
    throw new Error('USAGE: npm run test:instagram:url -- "https://www.instagram.com/usuario/" [--debug] [--raw] [--sessionid=SEU_ID]');
  }

  return { profileUrl, debug, sessionId, raw };
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function writeInstagramProfileCsv(filePath: string, profile: {
  username: string;
  name: string;
  publicacoes: number;
  seguidores: number;
  seguindo: number;
  bio: string;
  url: string;
  link?: string;
  linkTitulo?: string;
  bioLinks?: Array<{ title?: string; url?: string; link_type?: string }>;
  extractedAt: string;
}): void {
  const bioLinksCount = profile.bioLinks?.length || 0;
  const bioLinksUrls = profile.bioLinks?.map(l => l.url || '').join(' | ') || '';
  const bioLinksTitulos = profile.bioLinks?.map(l => l.title || '').join(' | ') || '';
  const bioLinksJson = profile.bioLinks ? JSON.stringify(profile.bioLinks) : '';

  const header = toCsvRow([
    'username',
    'name',
    'publicacoes',
    'seguidores',
    'seguindo',
    'bio',
    'link',
    'linkTitulo',
    'bioLinksCount',
    'bioLinksUrls',
    'bioLinksTitulos',
    'bioLinksJson',
    'url',
    'extractedAt'
  ]);

  const row = toCsvRow([
    profile.username,
    profile.name,
    profile.publicacoes,
    profile.seguidores,
    profile.seguindo,
    profile.bio,
    profile.link || '',
    profile.linkTitulo || '',
    bioLinksCount,
    bioLinksUrls,
    bioLinksTitulos,
    bioLinksJson,
    profile.url,
    profile.extractedAt
  ]);

  fs.writeFileSync(filePath, `${header}\n${row}`, 'utf-8');
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
  console.log(`Raw API: ${options.raw ? 'sim' : 'nao'}`);

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

    if (options.raw) {
      console.log('\n=== MODO RAW: Fazendo requisicao direta para API ===');
      const username = urlInfo.username || '';
      const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;

      const rawHeaders: Record<string, string> = {
        'User-Agent': fingerprint.fingerprint.navigator.userAgent,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `https://www.instagram.com/${username}/`,
        'x-ig-app-id': '936619743392459',
        'x-ig-www-claim': '0'
      };

      if (resolvedSessionId || contextSessionId) {
        rawHeaders['Cookie'] = `sessionid=${resolvedSessionId || contextSessionId}`;
      }

      try {
        const apiResponse = await page.request.get(apiUrl, {
          timeout: 15000,
          failOnStatusCode: false,
          headers: rawHeaders
        });

        const rawStatus = apiResponse.status();
        const rawHeadersResp = apiResponse.headers();
        let rawBody = '';

        try {
          const contentType = rawHeadersResp['content-type'] || '';
          if (contentType.toLowerCase().includes('application/json')) {
            const json = await apiResponse.json();
            rawBody = JSON.stringify(json, null, 2);
          } else {
            rawBody = await apiResponse.text();
          }
        } catch {
          rawBody = await apiResponse.text();
        }

        const rawOutputPath = path.join(DEBUG_DIR, `instagram-raw-api-${username}-${Date.now()}.json`);
        const rawDebug = {
          url: apiUrl,
          method: 'GET',
          requestHeaders: rawHeaders,
          status: rawStatus,
          responseHeaders: rawHeadersResp,
          body: rawBody,
          capturedAt: new Date().toISOString()
        };

        fs.writeFileSync(rawOutputPath, JSON.stringify(rawDebug, null, 2), 'utf-8');
        console.log(`Resposta raw salva em: ${rawOutputPath}`);
        console.log(`Status HTTP: ${rawStatus}`);
        console.log(`Content-Type: ${rawHeadersResp['content-type']}`);

        if (rawBody.length < 2000) {
          console.log(`\nCorpo da resposta:\n${rawBody}`);
        } else {
          console.log(`\nCorpo da resposta (primeiros 500 chars):\n${rawBody.slice(0, 500)}...`);
        }

        return;
      } catch (rawError) {
        console.error('Erro na requisicao raw:', (rawError as Error).message);
      }
    }

    const scraper = new InstagramProfileScraper();

    const startedAt = Date.now();
    const profile = await scraper.scrapeProfile(page, urlInfo.normalizedUrl);
    const durationMs = Date.now() - startedAt;

    if (profile) {
      const profilePath = path.join(OUTPUT_DIR, `instagram-profile-${profile.username}-${Date.now()}.csv`);
      writeInstagramProfileCsv(profilePath, profile);

      console.log('Extracao concluida com sucesso.');
      console.log(`Tempo: ${durationMs}ms`);
      console.log(`Arquivo: ${profilePath}`);
      console.log('Formato do arquivo: CSV');
      if (profile.bioLinks && profile.bioLinks.length > 0) {
        console.log(`Links na bio: ${profile.bioLinks.length} link(s) encontrado(s)`);
        profile.bioLinks.forEach((link, i) => {
          console.log(`  ${i + 1}. ${link.title || '(sem título)'} -> ${link.url}`);
        });
      }
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
