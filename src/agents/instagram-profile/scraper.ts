import { Page, BrowserContext } from 'playwright';
import { InstagramProfile } from './types';

const INSTAGRAM_PROFILE_SELECTORS = {
  headerSection: 'header section',
  closeButton: 'button[aria-label="Fechar"], button[aria-label="Close"]'
};

function extractProfileData(): Partial<InstagramProfile> {
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

function parseInstagramNumber(text: string): number {
  const clean = text.replace(/\s/g, '').toUpperCase();
  const match = clean.match(/[\d.,]+/);
  if (!match) return 0;
  
  let num = parseFloat(match[0].replace(',', '.'));
  
  if (clean.includes('K')) num *= 1000;
  else if (clean.includes('M')) num *= 1000000;
  
  return Math.round(num);
}

export class InstagramProfileScraper {
  async scrapeProfile(page: Page, profileUrl: string): Promise<InstagramProfile | null> {
    try {
      await page.goto(profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      
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
