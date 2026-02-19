import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { BROWSER_CONFIG, FALLBACK_CHANNELS, INSTAGRAM_URL } from './browser-config';
import { logger } from '../cli/logger';
import { ERROR_CODES } from '../types';
import { MESSAGES } from '../cli/messages';

export class Launcher {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async launch(): Promise<void> {
    logger.header();
    
    logger.start(MESSAGES.INIT_ENGINE);
    await this.delay(500);
    
    logger.update(MESSAGES.CHECK_ENV);
    await this.delay(500);
    
    logger.update(MESSAGES.CONFIG_BROWSER);
    await this.launchBrowser();
    
    logger.update(MESSAGES.OPEN_INSTAGRAM);
    await this.navigateToInstagram();
    
    logger.succeed(MESSAGES.SUCCESS);
    
    this.printInstructions();
  }

  private async launchBrowser(): Promise<void> {
    let lastError: Error | null = null;

    for (const channel of FALLBACK_CHANNELS) {
      try {
        if (channel === 'msedge') {
          logger.warn(MESSAGES.FALLBACK_EDGE);
        }

        this.browser = await chromium.launch({
          ...BROWSER_CONFIG,
          channel: channel
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

    logger.fail(ERROR_CODES.CHROME_NOT_FOUND.message);
    logger.error(
      ERROR_CODES.CHROME_NOT_FOUND.code,
      ERROR_CODES.CHROME_NOT_FOUND.message,
      ERROR_CODES.CHROME_NOT_FOUND.action
    );
    throw lastError;
  }

  private async navigateToInstagram(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      await this.page.goto(INSTAGRAM_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } catch (error) {
      logger.fail(ERROR_CODES.NETWORK_ERROR.message);
      logger.error(
        ERROR_CODES.NETWORK_ERROR.code,
        ERROR_CODES.NETWORK_ERROR.message,
        ERROR_CODES.NETWORK_ERROR.action
      );
      throw error;
    }
  }

  private printInstructions(): void {
    console.log('');
    console.log('════════════════════════════════════════════════════════');
    console.log('  Browser aberto! Você pode:');
    console.log('  • Navegar normalmente pelo Instagram');
    console.log('  • O browser permanecerá aberto após este script');
    console.log('  • Feche o browser quando terminar');
    console.log('════════════════════════════════════════════════════════');
    console.log('');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
