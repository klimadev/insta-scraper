export interface ProxyConfigInput {
  enabled: boolean;
  provider?: 'custom' | 'brightdata' | 'smartproxy';
  type?: 'residential' | 'mobile' | 'datacenter';
  server: string;
  username?: string;
  password?: string;
  rotationStrategy?: 'per-session' | 'per-request';
  geoTarget?: string;
}

export interface PlaywrightProxy {
  server: string;
  username?: string;
  password?: string;
}

export function loadProxyConfig(config?: ProxyConfigInput): PlaywrightProxy | null {
  if (!config || !config.enabled) {
    return null;
  }

  if (!config.server) {
    return null;
  }

  const proxy: PlaywrightProxy = {
    server: config.server
  };

  if (config.username) {
    proxy.username = config.username;
  }

  if (config.password) {
    proxy.password = config.password;
  }

  return proxy;
}

export function validateProxy(config: ProxyConfigInput): boolean {
  if (!config.enabled) {
    return true;
  }

  if (!config.server) {
    return false;
  }

  try {
    const url = new URL(config.server);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'socks5:';
  } catch {
    return false;
  }
}

export function resolveGeoConstraints(
  proxyGeo: string | undefined,
  fingerprintLocale: string
): { locale: string; timezone: string } {
  if (!proxyGeo) {
    return {
      locale: fingerprintLocale,
      timezone: 'America/Sao_Paulo'
    };
  }

  const geoLocaleMap: Record<string, { locale: string; timezone: string }> = {
    BR: { locale: 'pt-BR', timezone: 'America/Sao_Paulo' },
    US: { locale: 'en-US', timezone: 'America/New_York' },
    GB: { locale: 'en-GB', timezone: 'Europe/London' },
    DE: { locale: 'de-DE', timezone: 'Europe/Berlin' },
    FR: { locale: 'fr-FR', timezone: 'Europe/Paris' },
    ES: { locale: 'es-ES', timezone: 'Europe/Madrid' }
  };

  const geoConfig = geoLocaleMap[proxyGeo.toUpperCase()];
  if (geoConfig) {
    return geoConfig;
  }

  return {
    locale: fingerprintLocale,
    timezone: 'America/Sao_Paulo'
  };
}
