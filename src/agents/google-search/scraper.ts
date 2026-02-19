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
    await this.performSearch(finalConfig.query);
    
    const results = await this.scrapeMultiplePages(
      finalConfig.query,
      finalConfig.maxPages
    );
    
    const output = this.buildOutput(finalConfig.query, finalConfig.maxPages, results);
    
    await this.closeBrowser();
    
    return output;
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
          logger.warn('Chrome não encontrado, tentando Edge...');
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

      await this.delay(1000);

      await this.handleCookieConsent();

      await this.delay(500);

      const searchInput = this.page.getByRole(SEARCH_INPUT_ROLE, { name: SEARCH_INPUT_NAME });
      await searchInput.fill(query);
      await this.delay(300);
      await searchInput.press('Enter');

      await this.page.waitForLoadState('domcontentloaded');
      await this.delay(2000);
      
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

    const acceptButtons = [
      this.page.getByRole('button', { name: /aceitar|accept|concordo|i agree/i }),
      this.page.locator('#L2AGLb'),
      this.page.locator('button:has-text("Aceitar")'),
      this.page.locator('button:has-text("Accept")')
    ];

    for (const button of acceptButtons) {
      try {
        if (await button.count() > 0) {
          await button.first().click();
          await this.delay(500);
          return;
        }
      } catch {
        continue;
      }
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
      await this.delay(2000);
    }

    console.log('');
    console.log('  CAPTCHA resolvido! Continuando...');
    console.log('');
    await this.delay(1000);
  }

  private async scrapeMultiplePages(
    query: string,
    maxPages: number
  ): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      logger.update(`Extraindo página ${currentPage}...`);
      
      try {
        await this.page!.waitForSelector('h3', { timeout: 15000 });
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
      const data: { title: string; url: string; description: string }[] = [];
      const main = document.querySelector('#rso, [role="main"]');
      if (!main) return data;

      const items = main.querySelectorAll('div[data-hveid]');

      items.forEach((item: Element) => {
        const h3 = item.querySelector('h3');
        const a = item.querySelector('a[href^="http"]');

        if (!h3 || !a) return;

        const title = h3.textContent?.trim() || '';
        let description = '';

        const spans = Array.from(item.querySelectorAll('span, div'));
        for (const span of spans) {
          const text = span.textContent?.trim() || '';
          if (text.length > 50 && text !== title) {
            description = text;
            break;
          }
        }

        data.push({
          title,
          url: a.getAttribute('href') || '',
          description: description.substring(0, 300)
        });
      });

      return data.filter(r =>
        r.url &&
        !r.url.includes('google.com/search') &&
        !r.url.includes('accounts.google')
      );
    });
  }

  private async goToNextPage(): Promise<boolean> {
    if (!this.page) return false;

    const nextButton = this.page.getByRole(NEXT_PAGE_ROLE, { 
      name: NEXT_PAGE_NAME, 
      exact: true 
    });

    const count = await nextButton.count();
    if (count === 0) return false;

    await nextButton.click();
    await this.page.waitForLoadState('domcontentloaded');
    
    await this.delay(1000);
    
    return true;
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
