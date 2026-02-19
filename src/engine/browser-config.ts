import { BrowserConfig } from '../types';

export const BROWSER_CONFIG: BrowserConfig = {
  channel: 'chrome',
  headless: false,
  args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--disable-gpu'],
  viewport: null,
  ignoreDefaultArgs: ['--enable-automation'],
  timeout: 30000
};

export const FALLBACK_CHANNELS = ['chrome', 'msedge'];
