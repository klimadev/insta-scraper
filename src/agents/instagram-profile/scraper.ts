import { Page, BrowserContext } from 'playwright';
import { InstagramProfile } from './types';
import { logger } from '../../cli/logger';
import { resolveInstagramSessionIdFromEnv } from './session';
import { extractBrazilPhones } from '../../utils/phone';

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
const INSTAGRAM_WEB_APP_ID = '936619743392459';
const INSTAGRAM_WEB_PROFILE_INFO_ENDPOINT = 'https://www.instagram.com/api/v1/users/web_profile_info/?username=';
const INSTAGRAM_WEB_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
const INSTAGRAM_API_TIMEOUT_MS = 15000;
const INSTAGRAM_API_MAX_ATTEMPTS = 3;
const INSTAGRAM_API_RETRY_BASE_MS = 900;

interface InstagramWebProfileInfoResponse {
  data?: {
    user?: {
      username?: string;
      full_name?: string;
      biography?: string;
      bio_links?: Array<{
        title?: string;
        url?: string;
        link_type?: string;
      }>;
      external_url?: string;
      edge_followed_by?: {
        count?: number;
      };
      edge_follow?: {
        count?: number;
      };
      edge_owner_to_timeline_media?: {
        count?: number;
      };
      follower_count?: number;
      following_count?: number;
      media_count?: number;
    };
  };
  status?: string;
}

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
      const apiProfile = await this.tryApiProfileExtraction(page, profileUrl);
      if (apiProfile) {
        return apiProfile;
      }

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

      const extractedPhones = extractBrazilPhones({
        bio: profileData.bio || ''
      });
      
      return {
        username: profileData.username || '',
        name: profileData.name || '',
        publicacoes: profileData.publicacoes || 0,
        seguidores: profileData.seguidores || 0,
        seguindo: profileData.seguindo || 0,
        bio: profileData.bio || '',
        phonesPtBr: extractedPhones.phonesPtBr,
        phonesE164: extractedPhones.phonesE164,
        phonesDetails: extractedPhones.phonesDetails,
        primaryPhonePtBr: extractedPhones.primaryPhonePtBr,
        primaryPhoneE164: extractedPhones.primaryPhoneE164,
        primaryPhoneConfidence: extractedPhones.primaryPhoneConfidence,
        url: profileUrl,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      return null;
    }
  }

  private async tryApiProfileExtraction(page: Page, profileUrl: string): Promise<InstagramProfile | null> {
    const username = this.extractUsernameFromProfileUrl(profileUrl);
    if (!username) {
      return null;
    }

    let sessionId = resolveInstagramSessionIdFromEnv();

    if (sessionId) {
      await this.injectSessionCookie(page, sessionId);
      logger.info('Instagram: sessionid encontrado em INSTAGRAM_SESSIONID.');
    } else {
      sessionId = await this.getSessionIdFromContext(page);
      if (sessionId) {
        logger.info('Instagram: sessionid detectado automaticamente na sessao do browser.');
      }
    }

    let lastStatus: number | null = null;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= INSTAGRAM_API_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await page.request.get(
          `${INSTAGRAM_WEB_PROFILE_INFO_ENDPOINT}${encodeURIComponent(username)}`,
          {
            timeout: INSTAGRAM_API_TIMEOUT_MS,
            failOnStatusCode: false,
            headers: this.buildApiHeaders(sessionId, profileUrl)
          }
        );

        lastStatus = response.status();

        if (lastStatus === 200) {
          const contentType = response.headers()['content-type'] || '';
          if (!contentType.toLowerCase().includes('application/json')) {
            lastError = 'RESPOSTA_NAO_JSON';
          } else {
            const payload = await response.json() as InstagramWebProfileInfoResponse;
            const mapped = this.mapApiPayloadToProfile(payload, profileUrl);
            if (mapped) {
              logger.info(`Instagram: perfil @${username} extraido via web_profile_info.`);
              return mapped;
            }
            lastError = 'PAYLOAD_INVALIDO';
          }
        } else if (lastStatus === 404) {
          logger.warn(`Instagram: perfil @${username} nao encontrado via endpoint.`);
          return null;
        } else {
          lastError = `HTTP_${lastStatus}`;
        }
      } catch (error) {
        const err = error as Error;
        lastError = err.message;
      }

      if (attempt < INSTAGRAM_API_MAX_ATTEMPTS) {
        const jitter = Math.floor(Math.random() * 250);
        const waitTime = INSTAGRAM_API_RETRY_BASE_MS * attempt + jitter;
        await page.waitForTimeout(waitTime);
      }
    }

    logger.warn(
      `Instagram: fallback para DOM (endpoint bloqueado ou instavel${lastStatus ? `, status ${lastStatus}` : ''}${lastError ? `, motivo: ${lastError}` : ''}).`
    );

    return null;
  }

  private async getSessionIdFromContext(page: Page): Promise<string | null> {
    try {
      const cookies = await page.context().cookies('https://www.instagram.com');
      const sessionCookie = cookies.find(cookie => cookie.name === 'sessionid');
      if (!sessionCookie || !sessionCookie.value) {
        return null;
      }

      const value = sessionCookie.value.trim();
      return value || null;
    } catch {
      return null;
    }
  }

  private async injectSessionCookie(page: Page, sessionId: string): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;

    await page.context().addCookies([
      {
        name: 'sessionid',
        value: sessionId,
        domain: '.instagram.com',
        path: '/',
        expires: expiresAt,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
      }
    ]);
  }

  private buildApiHeaders(sessionId: string | null, profileUrl: string): Record<string, string> {
    const headers: Record<string, string> = {
      'x-ig-app-id': INSTAGRAM_WEB_APP_ID,
      'x-requested-with': 'XMLHttpRequest',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'user-agent': INSTAGRAM_WEB_USER_AGENT,
      referer: profileUrl
    };

    if (sessionId) {
      headers.cookie = `sessionid=${sessionId}`;
    }

    return headers;
  }

  private extractUsernameFromProfileUrl(profileUrl: string): string | null {
    try {
      const parsed = new URL(profileUrl);
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length === 0) {
        return null;
      }

      return segments[0];
    } catch {
      return null;
    }
  }

  private mapApiPayloadToProfile(payload: InstagramWebProfileInfoResponse, profileUrl: string): InstagramProfile | null {
    const user = payload.data?.user;
    if (!user?.username) {
      return null;
    }

    const publicacoes = this.resolveCount(
      user.edge_owner_to_timeline_media?.count,
      user.media_count
    );
    const seguidores = this.resolveCount(
      user.edge_followed_by?.count,
      user.follower_count
    );
    const seguindo = this.resolveCount(
      user.edge_follow?.count,
      user.following_count
    );

    const bioLinks = this.normalizeBioLinks(user.bio_links, user.external_url);
    const primaryLink = bioLinks[0];
    const extractedPhones = extractBrazilPhones({
      bio: user.biography || '',
      link: primaryLink?.url,
      bioLinks
    });

    return {
      username: user.username,
      name: user.full_name || '',
      publicacoes,
      seguidores,
      seguindo,
      bio: user.biography || '',
      url: profileUrl,
      link: primaryLink?.url,
      linkTitulo: primaryLink?.title,
      bioLinks,
      phonesPtBr: extractedPhones.phonesPtBr,
      phonesE164: extractedPhones.phonesE164,
      phonesDetails: extractedPhones.phonesDetails,
      primaryPhonePtBr: extractedPhones.primaryPhonePtBr,
      primaryPhoneE164: extractedPhones.primaryPhoneE164,
      primaryPhoneConfidence: extractedPhones.primaryPhoneConfidence,
      extractedAt: new Date().toISOString()
    };
  }

  private normalizeBioLinks(
    bioLinks?: Array<{ title?: string; url?: string; link_type?: string }>,
    externalUrl?: string
  ): Array<{ title?: string; url?: string; link_type?: string }> {
    const links: Array<{ title?: string; url?: string; link_type?: string }> = [];

    if (bioLinks && bioLinks.length > 0) {
      const seenUrls = new Set<string>();
      for (const link of bioLinks) {
        if (link.url && !seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          links.push({
            title: link.title,
            url: link.url,
            link_type: link.link_type
          });
        }
      }
    }

    if (links.length === 0 && externalUrl) {
      links.push({
        title: undefined,
        url: externalUrl,
        link_type: 'external'
      });
    }

    return links;
  }

  private resolveCount(...values: Array<number | undefined>): number {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.round(value));
      }
    }

    return 0;
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
