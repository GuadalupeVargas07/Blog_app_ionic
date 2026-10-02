import { Injectable } from '@angular/core';

export interface ApiServerConfig {
  protocol: 'http' | 'https';
  host: string;
  port: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiConfigService {
  private readonly storageKey = 'api_server_config';
  private readonly legacyStorageKey = 'api_base_url';

  getApiBaseUrl(): string {
    const config = this.getServerConfig();
    if (!config) {
      throw new Error('Configura la IP y el puerto del servidor desde Origen de datos.');
    }

    const url = new URL(`${config.protocol}://${config.host}`);
    url.port = config.port;
    url.pathname = '/API_aplicacion1';
    return url.toString().replace(/\/$/, '');
  }

  setApiBaseUrl(rawValue: string): string {
    const value = rawValue.trim();
    const candidate = /^https?:\/\//i.test(value) ? value : `http://${value}`;
    const url = new URL(candidate);
    const protocol = url.protocol === 'https:' ? 'https' : 'http';
    const port = url.port || (protocol === 'https' ? '443' : '80');
    this.saveServerConfig({ protocol, host: url.hostname, port });
    return this.getApiBaseUrl();
  }

  getServerConfig(): ApiServerConfig | null {
    const savedConfig = localStorage.getItem(this.storageKey);
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig) as ApiServerConfig;
        return this.validateConfig(parsed);
      } catch {
        localStorage.removeItem(this.storageKey);
      }
    }

    const legacyUrl = localStorage.getItem(this.legacyStorageKey);
    if (!legacyUrl) {
      return null;
    }

    try {
      const url = new URL(legacyUrl);
      if (url.hostname.toLowerCase() === 'localhost' || url.hostname === '127.0.0.1') {
        return null;
      }

      const config = this.validateConfig({
        protocol: url.protocol === 'https:' ? 'https' : 'http',
        host: url.hostname,
        port: url.port || (url.protocol === 'https:' ? '443' : '80'),
      });
      localStorage.setItem(this.storageKey, JSON.stringify(config));
      return config;
    } catch {
      return null;
    }
  }

  getServerOriginInput(): string {
    const config = this.getServerConfig();
    return config ? `${config.protocol}://${config.host}:${config.port}` : '';
  }

  resolveAssetUrl(rawValue: string | null | undefined): string | null {
    if (!rawValue) {
      return null;
    }

    const config = this.getServerConfig();
    if (!config) {
      return rawValue;
    }

    const apiUrl = new URL(this.getApiBaseUrl());
    try {
      const assetUrl = new URL(rawValue, `${apiUrl.toString()}/`);
      const hostname = assetUrl.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
        assetUrl.protocol = apiUrl.protocol;
        assetUrl.host = apiUrl.host;
      }
      return assetUrl.toString();
    } catch {
      return rawValue;
    }
  }

  setServerOrigin(rawValue: string): string {
    const value = rawValue.trim();
    const candidate = /^https?:\/\//i.test(value) ? value : `http://${value}`;

    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new Error('Ingresa una IP o nombre de equipo válido, con puerto HTTP opcional.');
    }

    if (!url.hostname || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
      throw new Error('Ingresa solo la IP o nombre del equipo y el puerto del servidor web.');
    }

    return this.saveServerConfig({
      protocol: url.protocol === 'https:' ? 'https' : 'http',
      host: url.hostname,
      port: url.port || (url.protocol === 'https:' ? '443' : '80'),
    });
  }

  saveServerConfig(config: ApiServerConfig): string {
    const validated = this.validateConfig(config);
    localStorage.setItem(this.storageKey, JSON.stringify(validated));
    localStorage.removeItem(this.legacyStorageKey);
    return this.getApiBaseUrl();
  }

  private validateConfig(config: ApiServerConfig): ApiServerConfig {
    const protocol = config.protocol;
    if (protocol !== 'http' && protocol !== 'https') {
      throw new Error('Selecciona HTTP o HTTPS.');
    }

    const host = String(config.host ?? '').trim();
    if (!host || /[\s/?#@]/.test(host)) {
      throw new Error('Ingresa una dirección IP o nombre de equipo válido.');
    }

    let url: URL;
    try {
      url = new URL(`${protocol}://${host}`);
    } catch {
      throw new Error('Ingresa una dirección IP o nombre de equipo válido.');
    }
    if (url.port || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Ingresa solo la IP o nombre del equipo; configura el puerto en su campo.');
    }

    const port = String(config.port ?? '').trim();
    const portNumber = Number(port);
    if (!/^\d+$/.test(port) || portNumber < 1 || portNumber > 65535) {
      throw new Error('El puerto debe ser un número entre 1 y 65535.');
    }
    if (portNumber === 3306) {
      throw new Error('3306 es el puerto de MySQL. Ingresa el puerto HTTP de Apache/PHP, normalmente 80 o 8080.');
    }

    return { protocol, host: url.hostname, port: String(portNumber) };
  }
}
