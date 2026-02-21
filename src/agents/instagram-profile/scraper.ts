import { Page, BrowserContext } from 'playwright';
import { InstagramProfile } from './types';
import { logger } from '../../cli/logger';

const INSTAGRAM_PROFILE_SELECTORS = {
  headerSection: 'header section',
  closeButton: 'button[aria-label="Fechar"], button[aria-label="Close"]'
};

const INSTAGRAM_LOGIN_SELECTORS = {
  usernameInput: 'input[name="username"]',
  passwordInput: 'input[name="password"]',
  submitButton: 'button[type="submit"]'
};

const INSTAGRAM_LOGIN_URL_PATTERNS = [
  '/accounts/login',
  '/login'
];

const LOGIN_NOTIFICATION_INTERVAL_MS = 25000;

function extractProfileData(): Partial<InstagramProfile> {
  function parseInstagramNumber(text: string): number {
    const clean = text.replace(/\s/g, '').toUpperCase();
    const match = clean.match(/[\d.,]+/);
    if (!match) return 0;

    let num = parseFloat(match[0].replace(',', '.'));

    if (clean.includes('K')) num *= 1000;
    else if (clean.includes('M')) num *= 1000000;

    return Math.round(num);
  }

  const header = document.querySelector('header');
  const section = header?.querySelector('section');
  const divs = section?.querySelectorAll(':scope > div');
  
  if (!divs || divs.length < 4) {
    return { username: '' };
  }
  
  const username = divs[0]?.querySelector('h2')?.textContent?.trim() || '';
  const name = divs[1]?.querySelector('span')?.textContent?.trim() || '';
  
  const listItems = divs[2]?.querySelectorAll('ul li');
  let publicacoes = 0, seguidores = 0, seguindo = 0;
  
  listItems?.forEach((li, i) => {
    const text = li.textContent || '';
    const num = parseInstagramNumber(text);
    if (i === 0) publicacoes = num;
    if (i === 1) seguidores = num;
    if (i === 2) seguindo = num;
  });
  
  const bioDiv = divs[3]?.querySelector('div');
  const firstSpan = bioDiv?.querySelector('span');
  let bio = firstSpan?.textContent?.trim() || '';
  bio = bio.replace(/\.\.\.?\s*mais\s*$/, '').trim();
  
  return { username, name, publicacoes, seguidores, seguindo, bio };
}

export class InstagramProfileScraper {
  async scrapeProfile(page: Page, profileUrl: string): Promise<InstagramProfile | null> {
    try {
      await page.goto(profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      
      await this.waitForLoginResolution(page, profileUrl);
      
      await page.waitForSelector(INSTAGRAM_PROFILE_SELECTORS.headerSection, {
        timeout: 15000
      });
      
      await this.closeLoginDialogIfPresent(page);
      
      const profileData = await page.evaluate(extractProfileData);
      
      if (!profileData.username) {
        return null;
      }
      
      return {
        username: profileData.username || '',
        name: profileData.name || '',
        publicacoes: profileData.publicacoes || 0,
        seguidores: profileData.seguidores || 0,
        seguindo: profileData.seguindo || 0,
        bio: profileData.bio || '',
        url: profileUrl,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      return null;
    }
  }
  
  private async closeLoginDialogIfPresent(page: Page): Promise<void> {
    try {
      const closeButton = page.locator(INSTAGRAM_PROFILE_SELECTORS.closeButton).first();
      const isVisible = await closeButton.isVisible({ timeout: 2000 });
      if (isVisible) {
        await closeButton.click({ timeout: 2000 });
      }
    } catch {
      return;
    }
  }

  private async isLoginPage(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    
    const hasLoginUrl = INSTAGRAM_LOGIN_URL_PATTERNS.some(pattern => url.includes(pattern));
    
    if (hasLoginUrl) {
      return true;
    }
    
    try {
      const usernameVisible = await page.locator(INSTAGRAM_LOGIN_SELECTORS.usernameInput).isVisible({ timeout: 1000 });
      const passwordVisible = await page.locator(INSTAGRAM_LOGIN_SELECTORS.passwordInput).isVisible({ timeout: 1000 });
      
      return usernameVisible && passwordVisible;
    } catch {
      return false;
    }
  }

  private async waitForLoginResolution(page: Page, profileUrl: string): Promise<boolean> {
    if (!await this.isLoginPage(page)) {
      return true;
    }

    this.printLoginRequired();

    process.stdout.write('\x07');

    let lastNotificationTime = Date.now();

    while (true) {
      await page.waitForTimeout(2000);

      const currentUrl = page.url().toLowerCase();
      const isStillLoginUrl = INSTAGRAM_LOGIN_URL_PATTERNS.some(pattern => currentUrl.includes(pattern));

      if (!isStillLoginUrl) {
        this.printLoginDetected();
        await page.waitForTimeout(1500);
        
        try {
          await page.goto(profileUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          return true;
        } catch {
          return false;
        }
      }

      try {
        const usernameVisible = await page.locator(INSTAGRAM_LOGIN_SELECTORS.usernameInput).isVisible({ timeout: 500 });
        
        if (!usernameVisible) {
          this.printLoginDetected();
          await page.waitForTimeout(1500);
          
          try {
            await page.goto(profileUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 30000
            });
            return true;
          } catch {
            return false;
          }
        }
      } catch {
        this.printLoginDetected();
        await page.waitForTimeout(1500);
        
        try {
          await page.goto(profileUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          return true;
        } catch {
          return false;
        }
      }

      const now = Date.now();
      if (now - lastNotificationTime >= LOGIN_NOTIFICATION_INTERVAL_MS) {
        process.stdout.write('\x07');
        console.log('  Aguardando login no Instagram...');
        lastNotificationTime = now;
      }
    }
  }

  private printLoginRequired(): void {
    console.log('');
    console.log('════════════════════════════════════════════════════════');
    console.log('  LOGIN DO INSTAGRAM NECESSARIO');
    console.log('════════════════════════════════════════════════════════');
    console.log('  Faca login manualmente no browser aberto.');
    console.log('  O scraping continuara automaticamente apos o login.');
    console.log('  Aguardando...');
    console.log('════════════════════════════════════════════════════════');
    console.log('');
    logger.warn('INSTAGRAM LOGIN - AGUARDANDO AUTENTICACAO MANUAL');
  }

  private printLoginDetected(): void {
    console.log('');
    console.log('  Login detectado! Continuando extracao...');
    console.log('');
  }
  
  async scrapeProfileInNewTab(
    context: BrowserContext,
    profileUrl: string
  ): Promise<InstagramProfile | null> {
    const page = await context.newPage();
    
    try {
      const profile = await this.scrapeProfile(page, profileUrl);
      return profile;
    } finally {
      await page.close();
    }
  }
}
