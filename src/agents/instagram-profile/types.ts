export interface BioLink {
  title?: string;
  url?: string;
  link_type?: string;
}

export interface InstagramProfile {
  username: string;
  name: string;
  publicacoes: number;
  seguidores: number;
  seguindo: number;
  bio: string;
  url: string;
  link?: string;
  linkTitulo?: string;
  bioLinks?: BioLink[];
  extractedAt: string;
}

export interface InstagramUrlInfo {
  isProfile: boolean;
  username: string | null;
  normalizedUrl: string | null;
}

const INSTAGRAM_DOMAINS = [
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
  'www.instagr.am'
];

const NON_PROFILE_PATHS = [
  '/p/',
  '/reel/',
  '/reels/',
  '/stories/',
  '/explore/',
  '/accounts/',
  '/direct/',
  '/tv/',
  '/channel/',
  '/saved/',
  '/tagged/',
  '/guide/'
];

export function parseInstagramUrl(url: string): InstagramUrlInfo {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    const isInstagram = INSTAGRAM_DOMAINS.some(d => 
      hostname === d || hostname.endsWith('.' + d)
    );
    
    if (!isInstagram) {
      return { isProfile: false, username: null, normalizedUrl: null };
    }
    
    const pathname = parsed.pathname;
    
    const isNonProfile = NON_PROFILE_PATHS.some(p => pathname.startsWith(p));
    if (isNonProfile) {
      return { isProfile: false, username: null, normalizedUrl: null };
    }
    
    const segments = pathname.split('/').filter(Boolean);
    
    if (segments.length === 0) {
      return { isProfile: false, username: null, normalizedUrl: null };
    }
    
    const username = segments[0];
    
    if (!username || username.startsWith('.') || username.includes('?')) {
      return { isProfile: false, username: null, normalizedUrl: null };
    }
    
    const normalizedUrl = `https://www.instagram.com/${username}/?hl=pt`;
    
    return { isProfile: true, username, normalizedUrl };
  } catch {
    return { isProfile: false, username: null, normalizedUrl: null };
  }
}

export function findFirstInstagramProfileUrl(urls: string[]): InstagramUrlInfo | null {
  for (const url of urls) {
    const info = parseInstagramUrl(url);
    if (info.isProfile && info.username && info.normalizedUrl) {
      return info;
    }
  }
  return null;
}
