import { BrowserConfig } from '../types';

export const BROWSER_CONFIG: BrowserConfig = {
  channel: 'chrome',
  args: [
    '--start-maximized',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--incognito',
    '--disable-extensions',
    '--disable-plugins',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=TrackingProtection3pcd,ImprovedCookieControls',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-translate',
    '--disable-notifications',
    '--disable-popup-blocking',
    '--disable-save-password-bubble',
    '--disable-infobars',
    '--disable-breakpad',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--disable-client-side-phishing-detection',
    '--disable-hang-monitor',
    '--metrics-recording-only',
    '--no-pings'
  ],
  viewport: null,
  ignoreDefaultArgs: ['--enable-automation'],
  timeout: 30000
};

export const FALLBACK_CHANNELS = ['chrome', 'msedge'];
