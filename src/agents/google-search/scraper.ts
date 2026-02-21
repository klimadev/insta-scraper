import { Browser, BrowserContext, Page } from 'playwright';
import { Cursor } from 'ghost-cursor-playwright';
import { BROWSER_CONFIG, FALLBACK_CHANNELS } from '../../engine/browser-config';
import { logger } from '../../cli/logger';
import { ERROR_CODES } from '../../types';
import { launchStealthBrowser } from './stealth-bootstrap';
import { generateSessionFingerprint, injectFingerprint, resolveTimezone, GeneratedFingerprint } from './stealth-profile';
import { createHumanCursor, humanMove, humanType } from './humanization';
import { loadSessionState, saveSessionState, StorageStateData } from '../../engine/session-manager';
import { loadProxyConfig, ProxyConfigInput } from '../../engine/proxy-config';
import {
  SearchResult,
  SearchOutput,
  GoogleSearchConfig,
  DEFAULT_CONFIG,
  ExtractedResult
} from './types';
import {
  GOOGLE_URL,
  CAPTCHA_INDICATORS,
  CAPTCHA_SELECTORS,
  CAPTCHA_FRAME_PATTERNS,
  NEXT_PAGE_ROLE,
  NEXT_PAGE_NAME
} from './selectors';
import { InstagramProfileScraper, findInstagramProfileUrls, InstagramProfile, InstagramUrlInfo } from '../instagram-profile';

const SEARCH_INPUT_SELECTOR = 'textarea[name="q"], input[name="q"]';
const RESULTS_READY_SELECTOR = '#search h3, #rso h3, h3';
const TRANSIENT_NAVIGATION_ERRORS = [
  'execution context was destroyed',
  'cannot find context with specified id',
  'target closed',
  'most likely because of a navigation'
];

export class GoogleSearchScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private cursor: Cursor | null = null;
  private fingerprint: GeneratedFingerprint | null = null;
  private captchaWaitLoopActive = false;
  private proxyConfig?: ProxyConfigInput;

  setProxy(config: ProxyConfigInput): void {
    this.proxyConfig = config;
  }

  async search(config: GoogleSearchConfig): Promise<SearchOutput> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const googleDorkQuery = this.buildGoogleDorkQuery(finalConfig.query);
    
    this.validateQuery(finalConfig.query);
    logger.info(`Dork aplicada: ${googleDorkQuery}`);
    
    await this.launchBrowser();
    
    try {
      await this.performSearch(googleDorkQuery);
      
      const results = await this.scrapeMultiplePages(
        finalConfig.query,
        finalConfig.maxPages
      );
      
      await this.scrapeInstagramProfiles(results);
      
      return this.buildOutput(finalConfig.query, finalConfig.maxPages, results);
    } finally {
      await this.closeBrowser();
    }
  }

  private buildGoogleDorkQuery(term: string): string {
    const sanitizedTerm = term
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/"/g, '');

    const termWithoutAccents = sanitizedTerm
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return `site:instagram.com ("wa.me" OR "whatsapp" OR "+55") AND ("${sanitizedTerm}" OR "${termWithoutAccents}") -help -support -blog -p`;
  }

  private validateQuery(query: string): void {
    if (!query || query.trim().length === 0) {
      logger.error(
        ERROR_CODES.GOOGLE_SEARCH_EMPTY_QUERY.code,
        ERROR_CODES.GOOGLE_SEARCH_EMPTY_QUERY.message,
        ERROR_CODES.GOOGLE_SEARCH_EMPTY_QUERY.action
      );
      throw new Error('EMPTY_QUERY');
    }
  }

  private async launchBrowser(): Promise<void> {
    let lastError: Error | null = null;
    this.fingerprint = generateSessionFingerprint();

    logger.info(`Fingerprint: ${this.fingerprint.fingerprint.navigator.userAgent.substring(0, 60)}...`);

    for (const channel of FALLBACK_CHANNELS) {
      try {
        if (channel === 'msedge') {
          logger.warn('Chrome nao encontrado, tentando Edge...');
        }

        this.browser = await launchStealthBrowser(channel);

        if (!this.fingerprint) {
          throw new Error('FINGERPRINT_NOT_GENERATED');
        }

        const savedState = await loadSessionState('google');
        const proxy = loadProxyConfig(this.proxyConfig);

        this.context = await this.browser.newContext({
          viewport: null,
          colorScheme: 'light',
          locale: this.fingerprint.fingerprint.navigator.language,
          timezoneId: resolveTimezone(this.fingerprint),
          userAgent: this.fingerprint.fingerprint.navigator.userAgent,
          storageState: savedState ? JSON.parse(JSON.stringify(savedState)) : undefined,
          ignoreHTTPSErrors: true,
          javaScriptEnabled: true,
          offline: false,
          ...(proxy ? { proxy } : {})
        });

        await injectFingerprint(this.context, this.fingerprint);

        this.page = await this.context.newPage();
        this.cursor = await createHumanCursor(this.page);
        
        return;
      } catch (error) {
        lastError = error as Error;
        continue;
      }
    }

    logger.error(
      ERROR_CODES.CHROME_NOT_FOUND.code,
      ERROR_CODES.CHROME_NOT_FOUND.message,
      ERROR_CODES.CHROME_NOT_FOUND.action
    );
    throw lastError;
  }

  private async performSearch(query: string): Promise<void> {
    if (!this.page || !this.cursor) throw new Error('Page not initialized');

    try {
      await this.navigateWithStealth(GOOGLE_URL);

      await this.handleCookieConsent();

      await humanMove(this.cursor, SEARCH_INPUT_SELECTOR);
      await humanType(this.page, SEARCH_INPUT_SELECTOR, query);
      await this.page.keyboard.press('Enter');

      await this.page.waitForLoadState('domcontentloaded');
      await this.waitForCaptchaResolution();
      await this.waitForResultsReady();
      
    } catch (error) {
      logger.error(
        ERROR_CODES.GOOGLE_SEARCH_TIMEOUT.code,
        ERROR_CODES.GOOGLE_SEARCH_TIMEOUT.message,
        ERROR_CODES.GOOGLE_SEARCH_TIMEOUT.action
      );
      throw error;
    }
  }

  private async navigateWithStealth(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('PAGE_NOT_INITIALIZED');
    }

    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
  }

  private async handleCookieConsent(): Promise<void> {
    if (!this.page || !this.cursor) return;

    const acceptButton = this.page.locator('#L2AGLb, button:has-text("Aceitar"), button:has-text("Accept")').first();
    
    try {
      const isVisible = await acceptButton.isVisible({ timeout: 2000 });
      if (isVisible) {
        await humanMove(this.cursor, '#L2AGLb, button:has-text("Aceitar"), button:has-text("Accept")');
      }
    } catch {
      return;
    }
  }

  private async waitForCaptchaResolution(): Promise<void> {
    if (!this.page) return;

    let initialSignal = await this.detectCaptchaSignal(true);

    if (!initialSignal.detected) return;
    if (this.captchaWaitLoopActive) return;

    const interactiveChallengeReady = await this.hasInteractiveCaptchaChallenge();

    if (!interactiveChallengeReady) {
      logger.warn('CAPTCHA sem widget visivel. Recarregando para tentar renderizar desafio.');

      try {
        await this.page.reload({
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        await this.page.waitForTimeout(1200);
        initialSignal = await this.detectCaptchaSignal(true);
      } catch {
        return;
      }

      if (!initialSignal.detected) {
        return;
      }
    }

    this.captchaWaitLoopActive = true;

    console.log('');
    console.log('════════════════════════════════════════════════════════');
    console.log('  CAPTCHA detectado!');
    console.log('  Por favor, resolva manualmente no browser aberto.');
    console.log('  Aguardando...');
    console.log('════════════════════════════════════════════════════════');
    console.log('');
    logger.warn('CAPTCHA DETECTADO - AGUARDANDO RESOLUCAO MANUAL');
    process.stdout.write('\x07');

    this.page.setDefaultTimeout(0);
    this.page.setDefaultNavigationTimeout(0);

    try {
      let clearChecks = 0;

      while (clearChecks < 3) {
        await this.page.waitForTimeout(1800);

        const currentSignal = await this.detectCaptchaSignal();

        if (currentSignal.detected) {
          clearChecks = 0;
          continue;
        }

        clearChecks += 1;
      }
    } finally {
      this.page.setDefaultTimeout(BROWSER_CONFIG.timeout);
      this.page.setDefaultNavigationTimeout(BROWSER_CONFIG.timeout);
      this.captchaWaitLoopActive = false;
    }

    console.log('');
    console.log('  CAPTCHA resolvido! Continuando...');
    console.log('');
  }

  private async hasInteractiveCaptchaChallenge(): Promise<boolean> {
    if (!this.page) return false;

    const bySelector = await this.findCaptchaSelector();
    if (bySelector) {
      return true;
    }

    for (const frame of this.page.frames()) {
      const frameUrl = frame.url().toLowerCase();
      if (CAPTCHA_FRAME_PATTERNS.some(pattern => frameUrl.includes(pattern))) {
        return true;
      }
    }

    return false;
  }

  private async detectCaptchaSignal(withObserver: boolean = false): Promise<{ detected: boolean; targetSelector: string | null }> {
    if (!this.page) {
      return {
        detected: false,
        targetSelector: null
      };
    }

    if (withObserver) {
      const observedSelector = await this.observeCaptchaSelector(1200);
      if (observedSelector) {
        return {
          detected: true,
          targetSelector: observedSelector
        };
      }
    }

    const bySelector = await this.findCaptchaSelector();

    if (bySelector) {
      return {
        detected: true,
        targetSelector: bySelector
      };
    }

    for (const frame of this.page.frames()) {
      const frameUrl = frame.url().toLowerCase();
      if (CAPTCHA_FRAME_PATTERNS.some(pattern => frameUrl.includes(pattern))) {
        return {
          detected: true,
          targetSelector: CAPTCHA_SELECTORS[0]
        };
      }
    }

    const lowerContent = await this.page.evaluate(() => {
      const text = document.body?.innerText || '';
      return text.slice(0, 6000).toLowerCase();
    }).catch((error: unknown) => {
      if (this.isTransientNavigationError(error)) {
        return '';
      }

      throw error;
    });
    const hasByText = CAPTCHA_INDICATORS.some(indicator =>
      lowerContent.includes(indicator.toLowerCase())
    );

    return {
      detected: hasByText,
      targetSelector: hasByText ? CAPTCHA_SELECTORS[0] : null
    };
  }

  private async findCaptchaSelector(): Promise<string | null> {
    if (!this.page) return null;

    for (const selector of CAPTCHA_SELECTORS) {
      const visible = await this.page
        .locator(selector)
        .first()
        .isVisible({ timeout: 250 })
        .catch(() => false);

      if (visible) {
        return selector;
      }
    }

    return null;
  }

  private async observeCaptchaSelector(timeoutMs: number): Promise<string | null> {
    if (!this.page) return null;

    try {
      const handle = await this.page.waitForFunction(
        (selectors: string[]) => {
          for (const selector of selectors) {
            if (document.querySelector(selector)) {
              return selector;
            }
          }

          return null;
        },
        CAPTCHA_SELECTORS,
        {
          timeout: timeoutMs
        }
      );

      const result = await handle.jsonValue();
      await handle.dispose();

      if (typeof result === 'string') {
        return result;
      }

      return null;
    } catch (error) {
      if (this.isTransientNavigationError(error)) {
        return null;
      }

      if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
        return null;
      }

      throw error;
    }
  }

  private async waitForResultsReady(timeoutMs: number = 15000): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    const deadline = Date.now() + timeoutMs;
    let lastError: unknown = null;

    while (Date.now() < deadline) {
      const remaining = Math.max(deadline - Date.now(), 1);

      try {
        await this.page.waitForSelector(RESULTS_READY_SELECTOR, {
          timeout: Math.min(2500, remaining)
        });
        return;
      } catch (error) {
        lastError = error;

        if (this.isTransientNavigationError(error)) {
          await this.waitForStableDom();
          continue;
        }

        if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
          continue;
        }

        throw error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error('RESULTS_TIMEOUT');
  }

  private async waitForStableDom(): Promise<void> {
    if (!this.page) return;

    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    } catch {
      return;
    }
  }

  private isTransientNavigationError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return TRANSIENT_NAVIGATION_ERRORS.some(fragment => message.includes(fragment));
  }

  private async scrapeMultiplePages(
    query: string,
    maxPages: number
  ): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      logger.update(`Extraindo pagina ${currentPage}...`);
      
      try {
        await this.page!.waitForSelector('h3', { timeout: 10000 });
      } catch {
        break;
      }

      const results = await this.extractResultsFromPage();
      
      const enriched = results.map(r => ({
        ...r,
        source: 'google' as const,
        status: 'not_instagram' as const,
        extractedAt: new Date().toISOString(),
        query,
        page: currentPage
      }));

      allResults.push(...enriched);

      if (currentPage < maxPages) {
        const hasNextPage = await this.goToNextPage();
        if (!hasNextPage) break;
      }
    }

    return allResults;
  }

  private async extractResultsFromPage(): Promise<ExtractedResult[]> {
    return await this.page!.evaluate(() => {
      const data: ExtractedResult[] = [];
      const main = document.querySelector('#rso, [role="main"]');
      if (!main) return data;

      const items = Array.from(main.querySelectorAll('div[data-hveid]'));

      for (const item of items) {
        const h3 = item.querySelector('h3');
        const a = item.querySelector('a[href^="http"]');

        if (!h3 || !a) continue;

        const title = h3.textContent?.trim() || '';
        const url = a.getAttribute('href') || '';
        
        if (!url || url.includes('google.com/search') || url.includes('accounts.google')) {
          continue;
        }

        let description = '';
        const spans = Array.from(item.querySelectorAll('span, div'));
        for (const span of spans) {
          const text = span.textContent?.trim() || '';
          if (text.length > 50 && text !== title) {
            description = text.substring(0, 300);
            break;
          }
        }

        data.push({ title, url, description });
      }

      return data;
    });
  }

  private async goToNextPage(): Promise<boolean> {
    if (!this.page || !this.cursor) return false;

    const nextButton = this.page.getByRole(NEXT_PAGE_ROLE, { 
      name: NEXT_PAGE_NAME, 
      exact: true 
    });

    try {
      await Promise.all([
        this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }),
        nextButton.click({ timeout: 3000 })
      ]);
      return true;
    } catch {
      return false;
    }
  }

  private buildOutput(
    query: string,
    maxPages: number,
    results: SearchResult[]
  ): SearchOutput {
    return {
      query,
      totalPages: maxPages,
      totalResults: results.length,
      extractedAt: new Date().toISOString(),
      results
    };
  }

  private async closeBrowser(): Promise<void> {
    if (this.context) {
      try {
        const state = await this.context.storageState() as StorageStateData;
        await saveSessionState('google', state);
      } catch {
        // Context may already be closed
      }
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.cursor = null;
    }
  }

  private async scrapeInstagramProfiles(results: SearchResult[]): Promise<void> {
    if (!this.context || results.length === 0) return;

    const urls = results.map(r => r.url);
    const profileUrls = findInstagramProfileUrls(urls);

    if (profileUrls.length === 0) {
      logger.warn('Nenhum perfil do Instagram encontrado nos resultados.');
      return;
    }

    const MAX_INSTAGRAM_PROFILES = 25;
    const profilesToProcess = profileUrls.slice(0, MAX_INSTAGRAM_PROFILES);
    const skipped = profileUrls.length - profilesToProcess.length;

    logger.update(`Encontrados ${profileUrls.length} perfis. Processando ate ${MAX_INSTAGRAM_PROFILES}...`);

    const scraper = new InstagramProfileScraper();

    const processed = new Set<string>();
    let successCount = 0;
    let failCount = 0;
    let duplicateCount = 0;
    let skipCount = 0;

    for (let i = 0; i < profilesToProcess.length; i++) {
      const profileInfo = profilesToProcess[i];
      const username = profileInfo.username!;

      if (processed.has(username)) {
        duplicateCount++;
        this.markResultAsDuplicate(results, username);
        continue;
      }
      processed.add(username);

      logger.update(`Processando perfil ${i + 1}/${profilesToProcess.length}: @${username}`);

      const profile = await scraper.scrapeProfileInNewTab(
        this.context,
        profileInfo.normalizedUrl!
      );

      if (profile) {
        this.updateResultWithInstagramData(results, profile);
        this.printInstagramProfile(profile);
        successCount++;
      } else {
        this.markResultAsFailed(results, username);
        failCount++;
      }

      if (i < profilesToProcess.length - 1) {
        const baseDelay = 3500;
        const jitter = Math.floor(Math.random() * 3000);
        const delay = baseDelay + jitter;
        await this.page!.waitForTimeout(delay);
      }
    }

    if (skipped > 0) {
      skipCount = skipped;
      logger.info(`Limite atingido. ${skipped} perfis ignorados (max: ${MAX_INSTAGRAM_PROFILES}).`);
    }

    logger.succeed(
      `Instagram: ${successCount} OK, ${failCount} falha(s), ${duplicateCount} duplicado(s), ${skipCount} ignorado(s)`
    );
  }

  private markResultAsDuplicate(results: SearchResult[], username: string): void {
    const result = results.find(r => r.url.includes(`instagram.com/${username}`));
    if (result) {
      result.status = 'duplicate_instagram';
    }
  }

  private markResultAsFailed(results: SearchResult[], username: string): void {
    const result = results.find(r => r.url.includes(`instagram.com/${username}`));
    if (result) {
      result.status = 'instagram_failed';
    }
  }

  private updateResultWithInstagramData(results: SearchResult[], profile: InstagramProfile): void {
    const result = results.find(r => r.url.includes(`instagram.com/${profile.username}`));
    if (result) {
      result.status = 'instagram_ok';
      result.instagramUsername = profile.username;
      result.instagramName = profile.name;
      result.instagramPublicacoes = profile.publicacoes;
      result.instagramSeguidores = profile.seguidores;
      result.instagramSeguindo = profile.seguindo;
      result.instagramBio = profile.bio;
      result.instagramLink = profile.link;
      result.instagramPhonesPtBr = profile.phonesPtBr;
      result.instagramPhonesE164 = profile.phonesE164;
      result.instagramPhonesDetails = profile.phonesDetails;
      result.instagramPrimaryPhonePtBr = profile.primaryPhonePtBr;
      result.instagramPrimaryPhoneE164 = profile.primaryPhoneE164;
      result.instagramPrimaryPhoneConfidence = profile.primaryPhoneConfidence;
      result.instagramExtractedAt = profile.extractedAt;
    }
  }

  private printInstagramProfile(profile: InstagramProfile): void {
    console.log('');
    console.log('════════════════════════════════════════════════════════');
    console.log('  PERFIL DO INSTAGRAM');
    console.log('════════════════════════════════════════════════════════');
    console.log(`  Username: @${profile.username}`);
    console.log(`  Nome: ${profile.name}`);
    console.log(`  Publicacoes: ${profile.publicacoes.toLocaleString('pt-BR')}`);
    console.log(`  Seguidores: ${profile.seguidores.toLocaleString('pt-BR')}`);
    console.log(`  Seguindo: ${profile.seguindo.toLocaleString('pt-BR')}`);
    if (profile.bio) {
      console.log(`  Bio: ${profile.bio}`);
    }
    if (profile.phonesPtBr && profile.phonesPtBr.length > 0) {
      console.log(`  Telefones: ${profile.phonesPtBr.join(' | ')}`);
    }
    if (profile.primaryPhonePtBr && profile.primaryPhoneConfidence) {
      console.log(`  Telefone principal: ${profile.primaryPhonePtBr} (${profile.primaryPhoneConfidence})`);
    }
    console.log('════════════════════════════════════════════════════════');
    console.log('');
  }
}
