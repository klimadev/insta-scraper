import { Browser, chromium as playwrightChromium } from 'playwright';
import { BROWSER_CONFIG } from '../../engine/browser-config';
import { logger } from '../../cli/logger';

type ChromiumDriver = {
  use: (plugin: unknown) => void;
  launch: (options: Record<string, unknown>) => Promise<Browser>;
};

let chromiumDriver: ChromiumDriver | null = null;
let stealthPluginFactory: (() => unknown) | null = null;

let stealthConfigured = false;
let stealthAvailable = true;

function loadStealthRuntime(): void {
  if (chromiumDriver || !stealthAvailable) {
    return;
  }

  try {
    const chromiumExtraModule = require('playwright-extra');
    stealthPluginFactory = require('puppeteer-extra-plugin-stealth') as () => unknown;
    chromiumDriver = chromiumExtraModule.chromium as ChromiumDriver;
  } catch {
    stealthAvailable = false;
    logger.info('Stealth indisponivel neste runtime. Usando Playwright padrao.');
  }
}

function ensureStealthPlugin(): void {
  if (stealthConfigured || !stealthAvailable) {
    return;
  }

  loadStealthRuntime();

  if (!chromiumDriver || !stealthPluginFactory) {
    stealthAvailable = false;
    return;
  }

  try {
    chromiumDriver.use(stealthPluginFactory());
    stealthConfigured = true;
    logger.info('Stealth plugin ativado.');
  } catch {
    stealthAvailable = false;
    logger.info('Falha ao ativar stealth plugin. Usando Playwright padrao.');
  }
}

export async function launchStealthBrowser(
  channel: string
): Promise<Browser> {
  ensureStealthPlugin();

  const launchOptions = {
    ...BROWSER_CONFIG,
    channel,
    headless: false
  };

  if (!stealthAvailable || !chromiumDriver) {
    return playwrightChromium.launch(launchOptions);
  }

  try {
    return await chromiumDriver.launch(launchOptions);
  } catch (error) {
    const message = (error as Error).message || 'erro desconhecido';
    stealthAvailable = false;
    logger.warn(`Falha no launch com stealth plugin: ${message}`);
    logger.info('Aplicando fallback para Playwright com perfil stealth.');
    return playwrightChromium.launch(launchOptions);
  }
}
