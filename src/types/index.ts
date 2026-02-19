export interface BrowserConfig {
  channel: string;
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
  },
  GOOGLE_SEARCH_EMPTY_QUERY: {
    code: 'ERR_SEARCH_001',
    message: 'Query de busca não pode estar vazia.',
    action: 'Forneça um termo de busca válido.'
  },
  GOOGLE_SEARCH_NO_RESULTS: {
    code: 'ERR_SEARCH_002',
    message: 'Nenhum resultado encontrado.',
    action: 'Tente uma query diferente.'
  },
  GOOGLE_SEARCH_TIMEOUT: {
    code: 'ERR_SEARCH_003',
    message: 'Timeout ao aguardar resultados.',
    action: 'Verifique sua conexão ou tente novamente.'
  },
  GOOGLE_SEARCH_CAPTCHA: {
    code: 'ERR_SEARCH_004',
    message: 'CAPTCHA detectado pelo Google.',
    action: 'Resolva o CAPTCHA manualmente na janela do navegador.'
  },
  GOOGLE_SEARCH_BLOCKED: {
    code: 'ERR_SEARCH_005',
    message: 'Acesso bloqueado pelo Google.',
    action: 'Mude de IP ou aguarde alguns minutos.'
  }
};
