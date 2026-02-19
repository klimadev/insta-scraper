export interface BrowserConfig {
  channel: string;
  headless: boolean;
  args: string[];
  viewport: null;
  ignoreDefaultArgs: string[];
  timeout: number;
}

export interface ErrorInfo {
  code: string;
  message: string;
  action: string;
}

export const ERROR_CODES: Record<string, ErrorInfo> = {
  CHROME_NOT_FOUND: {
    code: 'ERR_BROWSER_001',
    message: 'Chrome não encontrado. Instale o Google Chrome.',
    action: 'Download: https://chrome.google.com'
  },
  LAUNCH_TIMEOUT: {
    code: 'ERR_BROWSER_002',
    message: 'Timeout ao iniciar browser.',
    action: 'Verifique se Chrome está respondendo.'
  },
  NETWORK_ERROR: {
    code: 'ERR_NET_001',
    message: 'Falha ao conectar ao Instagram.',
    action: 'Verifique sua conexão com a internet.'
  }
};
