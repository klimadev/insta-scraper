import { Browser, chromium } from 'playwright';
import { BROWSER_CONFIG } from '../../engine/browser-config';

export async function launchStealthBrowser(channel: string): Promise<Browser> {
  return chromium.launch({
    ...BROWSER_CONFIG,
    channel,
    headless: false
  });
}
