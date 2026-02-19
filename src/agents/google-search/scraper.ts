import { Browser, BrowserContext, Page } from 'playwright';
import { BROWSER_CONFIG, FALLBACK_CHANNELS } from '../../engine/browser-config';
import { logger } from '../../cli/logger';
import { ERROR_CODES } from '../../types';
import { launchStealthBrowser } from './stealth-bootstrap';
import { applySessionProfile, pickSessionProfile, UserAgentProfile } from './stealth-profile';
import { humanMove, humanType } from './humanization';
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

const SEARCH_INPUT_SELECTOR = 'textarea[name="q"], input[name="q"]';
const RESULTS_READY_SELECTOR = '#search h3, #rso h3, h3';
const MAX_CAPTCHA_WAIT_MS = 120000;

export class GoogleSearchScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionProfile: UserAgentProfile | null = null;
  private captchaWaitLoopActive = false;

  async search(config: GoogleSearchConfig): Promise<SearchOutput> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    this.validateQuery(finalConfig.query);
    
    await this.launchBrowser();
    
    try {
      await this.performSearch(finalConfig.query);
      
      const results = await this.scrapeMultiplePages(
        finalConfig.query,
        finalConfig.maxPages
      );
      
      return this.buildOutput(finalConfig.query, finalConfig.maxPages, results);
    } finally {
      await this.closeBrowser();
    }
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
    this.sessionProfile = pickSessionProfile();

    for (const channel of FALLBACK_CHANNELS) {
      try {
        if (channel === 'msedge') {
          logger.warn('Chrome nao encontrado, tentando Edge...');
        }

        this.browser = await launchStealthBrowser(channel);

        const profile = this.sessionProfile;
        if (!profile) {
          throw new Error('STEALTH_PROFILE_NOT_SET');
        }

        this.context = await this.browser.newContext({
          viewport: null,
          locale: profile.locale,
          timezoneId: profile.timezoneId,
          userAgent: profile.userAgent,
          ignoreHTTPSErrors: true,
          javaScriptEnabled: true,
          offline: false
        });

        await applySessionProfile(this.context, profile);

        this.page = await this.context.newPage();
        
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
    if (!this.page) throw new Error('Page not initialized');

    try {
      await this.navigateWithStealth(GOOGLE_URL);

      await this.handleCookieConsent();

      await humanMove(this.page, SEARCH_INPUT_SELECTOR);
      await humanType(this.page, SEARCH_INPUT_SELECTOR, query);
      await this.page.keyboard.press('Enter');

      await this.page.waitForLoadState('domcontentloaded');
      await this.waitForCaptchaResolution();
      await this.page.waitForSelector(RESULTS_READY_SELECTOR, { timeout: 15000 });
      
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
    if (!this.page || !this.context || !this.sessionProfile) {
      throw new Error('STEALTH_NOT_INITIALIZED');
    }

    await this.context.setExtraHTTPHeaders({
      'accept-language': this.sessionProfile.acceptLanguage,
      'sec-ch-ua': this.sessionProfile.secChUa,
      'sec-ch-ua-mobile': this.sessionProfile.secChUaMobile,
      'sec-ch-ua-platform': this.sessionProfile.secChUaPlatform,
      'upgrade-insecure-requests': '1'
    });

    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
  }

  private async handleCookieConsent(): Promise<void> {
    if (!this.page) return;

    const acceptButton = this.page.locator('#L2AGLb, button:has-text("Aceitar"), button:has-text("Accept")').first();
    
    try {
      await acceptButton.click({ timeout: 2000 });
    } catch {
      return;
    }
  }

  private async waitForCaptchaResolution(): Promise<void> {
    if (!this.page) return;

    const initialSignal = await this.detectCaptchaSignal(true);

    if (!initialSignal.detected) return;
    if (this.captchaWaitLoopActive) return;

    this.captchaWaitLoopActive = true;

    console.log('');
    console.log('════════════════════════════════════════════════════════');
    console.log('  CAPTCHA detectado!');
    console.log('  Por favor, resolva manualmente no browser aberto.');
    console.log('  Aguardando...');
    console.log('════════════════════════════════════════════════════════');
    console.log('');
    logger.warn('CAPTCHA DETECTADO - AGUARDANDO RESOLUÇÃO MANUAL');
    process.stdout.write('\x07');

    this.page.setDefaultTimeout(0);
    this.page.setDefaultNavigationTimeout(0);

    try {
      let clearChecks = 0;
      const deadline = Date.now() + MAX_CAPTCHA_WAIT_MS;

      while (clearChecks < 3 && Date.now() < deadline) {
        await this.page.waitForTimeout(1800);

        const currentSignal = await this.detectCaptchaSignal();

        if (currentSignal.detected) {
          clearChecks = 0;
          continue;
        }

        clearChecks += 1;
      }

      if (clearChecks < 3) {
        logger.warn('Tempo limite de espera por CAPTCHA atingido. Continuando com a execucao.');
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

    const handle = await this.page.evaluateHandle(
      ({ selectors, timeout }) => {
        return new Promise<string | null>(resolve => {
          const findMatch = (): string | null => {
            for (const selector of selectors) {
              if (document.querySelector(selector)) {
                return selector;
              }
            }

            return null;
          };

          const immediateMatch = findMatch();
          if (immediateMatch) {
            resolve(immediateMatch);
            return;
          }

          let timer = 0;

          const observer = new MutationObserver(() => {
            const currentMatch = findMatch();

            if (currentMatch) {
              observer.disconnect();
              clearTimeout(timer);
              resolve(currentMatch);
            }
          });

          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true
          });

          timer = window.setTimeout(() => {
            observer.disconnect();
            resolve(null);
          }, timeout);
        });
      },
      {
        selectors: CAPTCHA_SELECTORS,
        timeout: timeoutMs
      }
    );

    const result = await handle.jsonValue();
    await handle.dispose();

    if (typeof result === 'string') {
      return result;
    }

    return null;
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
        status: 'pending_instagram' as const,
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
    if (!this.page) return false;

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
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}
