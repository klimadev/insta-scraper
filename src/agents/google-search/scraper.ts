import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { BROWSER_CONFIG, FALLBACK_CHANNELS } from '../../engine/browser-config';
import { logger } from '../../cli/logger';
import { ERROR_CODES } from '../../types';
import {
  SearchResult,
  SearchOutput,
  GoogleSearchConfig,
  DEFAULT_CONFIG,
  ExtractedResult
} from './types';
import {
  GOOGLE_URL,
  SEARCH_INPUT_ROLE,
  SEARCH_INPUT_NAME,
  CAPTCHA_INDICATORS,
  NEXT_PAGE_ROLE,
  NEXT_PAGE_NAME
} from './selectors';

export class GoogleSearchScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async search(config: GoogleSearchConfig): Promise<SearchOutput> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    this.validateQuery(finalConfig.query);
    
    await this.launchBrowser(finalConfig.headless);
    
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

  private async launchBrowser(headless: boolean): Promise<void> {
    let lastError: Error | null = null;

    for (const channel of FALLBACK_CHANNELS) {
      try {
        if (channel === 'msedge') {
          logger.warn('Chrome nao encontrado, tentando Edge...');
        }

        this.browser = await chromium.launch({
          ...BROWSER_CONFIG,
          channel: channel,
          headless: headless
        });

        this.context = await this.browser.newContext({
          viewport: null
        });

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
      await this.page.goto(GOOGLE_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await this.handleCookieConsent();

      const searchInput = this.page.getByRole(SEARCH_INPUT_ROLE, { name: SEARCH_INPUT_NAME });
      await searchInput.fill(query);
      await searchInput.press('Enter');

      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(1500);
      
      await this.waitForCaptchaResolution();
      
    } catch (error) {
      logger.error(
        ERROR_CODES.GOOGLE_SEARCH_TIMEOUT.code,
        ERROR_CODES.GOOGLE_SEARCH_TIMEOUT.message,
        ERROR_CODES.GOOGLE_SEARCH_TIMEOUT.action
      );
      throw error;
    }
  }

  private async handleCookieConsent(): Promise<void> {
    if (!this.page) return;

    const acceptButton = this.page.locator('#L2AGLb, button:has-text("Aceitar"), button:has-text("Accept")').first();
    
    try {
      await acceptButton.click({ timeout: 2000 });
    } catch {
      // Cookie consent already accepted or not present
    }
  }

  private async waitForCaptchaResolution(): Promise<void> {
    if (!this.page) return;

    const hasCaptcha = async (): Promise<boolean> => {
      const content = await this.page!.content();
      const lowerContent = content.toLowerCase();
      return CAPTCHA_INDICATORS.some(indicator => 
        lowerContent.includes(indicator.toLowerCase())
      );
    };

    if (!(await hasCaptcha())) return;

    console.log('');
    console.log('════════════════════════════════════════════════════════');
    console.log('  CAPTCHA detectado!');
    console.log('  Por favor, resolva manualmente no browser aberto.');
    console.log('  Aguardando...');
    console.log('════════════════════════════════════════════════════════');
    console.log('');

    while (await hasCaptcha()) {
      await this.page.waitForTimeout(2000);
    }

    console.log('');
    console.log('  CAPTCHA resolvido! Continuando...');
    console.log('');
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
      await nextButton.click({ timeout: 3000 });
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(800);
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
