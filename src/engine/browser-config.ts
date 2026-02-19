import { BrowserConfig } from '../types';

export const BROWSER_CONFIG: BrowserConfig = {
  channel: 'chrome',
  headless: false,
  args: ['--start-maximized'],
  viewport: null,
  ignoreDefaultArgs: ['--enable-automation'],
  timeout: 30000
};

export const FALLBACK_CHANNELS = ['chrome', 'msedge'];

export const INSTAGRAM_URL = 'https://instagram.com';
