import { Injectable, signal } from '@angular/core';
import axios from 'axios';
import { ApiConfigService } from './api-config.service';

export type ApiConnectionStatus = 'unconfigured' | 'idle' | 'connecting' | 'connected' | 'error';

export interface ApiDiagnostic {
  status: ApiConnectionStatus;
  method: string;
  url: string;
  host: string;
  payload: string;
  message: string;
  httpStatus: number | null;
  updatedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class ApiDiagnosticsService {
  readonly diagnostic = signal<ApiDiagnostic>({
    status: 'unconfigured',
    method: '',
    url: '',
    host: '',
    payload: '{}',
    message: 'Configura el origen de datos para probar la conexión.',
    httpStatus: null,
    updatedAt: null,
  });
  readonly modalOpen = signal(false);

  private requestSequence = 0;
  private activeRequestId = 0;

  constructor(private readonly apiConfig: ApiConfigService) {
    try {
      const baseUrl = apiConfig.getApiBaseUrl();
      const host = new URL(baseUrl).host;
      this.diagnostic.set({
        ...this.diagnostic(),
        status: 'idle',
        host,
        message: 'Servidor configurado. Esperando una solicitud para comprobar la conexión.',
      });
    } catch {
      // La pantalla de origen de datos permite configurar el servidor antes de usar la API.
    }

    axios.interceptors.request.use((config) => {
      const requestId = ++this.requestSequence;
      this.activeRequestId = requestId;
      (config as typeof config & { __apiDiagnosticId?: number }).__apiDiagnosticId = requestId;

      const url = this.getRequestUrl(config);
      const host = this.getHost(url);
      const params = this.formatPayload(config.params);
      const body = this.formatPayload(config.data);
      const payload = JSON.stringify({ params, body }, null, 2);

      this.diagnostic.set({
        status: 'connecting',
        method: (config.method ?? 'GET').toUpperCase(),
        url,
        host,
        payload,
        message: `Conectando con ${host || 'el servidor'}...`,
        httpStatus: null,
        updatedAt: new Date().toISOString(),
      });

      return config;
    });

    axios.interceptors.response.use(
      (response) => {
        const requestId = (response.config as typeof response.config & { __apiDiagnosticId?: number }).__apiDiagnosticId;
        if (requestId === this.activeRequestId) {
          this.diagnostic.update((current) => ({
            ...current,
            status: 'connected',
            message: 'La API respondió correctamente.',
            httpStatus: response.status,
            updatedAt: new Date().toISOString(),
          }));
        }
        return response;
      },
      (error: unknown) => {
        const axiosError = error as {
          config?: {
            __apiDiagnosticId?: number;
            url?: string;
            baseURL?: string;
            method?: string;
            params?: unknown;
            data?: unknown;
          };
          response?: { status?: number; data?: { message?: string } };
          message?: string;
        };
        const current = this.diagnostic();
        const failedConfig = axiosError.config;
        const failedUrl = failedConfig ? this.getRequestUrl(failedConfig) : current.url;
        const failedPayload = failedConfig
          ? JSON.stringify({
            params: this.formatPayload(failedConfig.params),
            body: this.formatPayload(failedConfig.data),
          }, null, 2)
          : current.payload;
        this.diagnostic.set({
          ...current,
          status: 'error',
          method: failedConfig?.method?.toUpperCase() ?? current.method,
          url: failedUrl,
          host: failedUrl ? this.getHost(failedUrl) : current.host,
          payload: failedPayload,
          message: axiosError.response?.data?.message ?? axiosError.message ?? 'Error al conectar con la API.',
          httpStatus: axiosError.response?.status ?? null,
          updatedAt: new Date().toISOString(),
        });
        this.modalOpen.set(true);
        return Promise.reject(error);
      },
    );
  }

  async testConnection(): Promise<void> {
    let url: string;
    try {
      url = `${this.apiConfig.getApiBaseUrl()}/login.php`;
    } catch (error) {
      this.reportApplicationError(error instanceof Error ? error.message : 'Configura el servidor de la API.');
      return;
    }

    const host = this.getHost(url);
    this.diagnostic.set({
      status: 'connecting',
      method: 'POST',
      url,
      host,
      payload: '{"purpose":"connection-check"}',
      message: `Probando API y base de datos en ${host}...`,
      httpStatus: null,
      updatedAt: new Date().toISOString(),
    });

    try {
      const body = new URLSearchParams({
        email: `connection-check-${Date.now()}-${Math.random().toString(36).slice(2)}@invalid.invalid`,
        password: `connection-check-${Math.random().toString(36).slice(2)}`,
      });
      const response = await axios.post(url, body, {
        timeout: 8000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        validateStatus: () => true,
      });
      const databaseAnswered = response.status === 401 || response.status === 404;
      this.diagnostic.update((current) => ({
        ...current,
        status: response.status >= 500 ? 'error' : 'connected',
        httpStatus: response.status,
        message: databaseAnswered
          ? `La API respondió y pudo consultar MySQL. La prueba no crea ni modifica cuentas. HTTP ${response.status}.`
          : response.status >= 500
            ? `La API respondió HTTP ${response.status}, pero PHP no pudo completar la consulta. Revisa MySQL y la configuración de la base de datos.`
            : `La laptop respondió HTTP ${response.status}. Verifica la respuesta de login; MySQL se consulta desde PHP, no desde el celular.`,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error: unknown) {
      const axiosError = axios.isAxiosError(error) ? error : null;
      const reason = axiosError?.code === 'ECONNABORTED' || axiosError?.code === 'ETIMEDOUT'
        ? 'Axios agotó el tiempo de espera al conectar.'
        : axiosError?.response
          ? `La API respondió con error HTTP ${axiosError.response.status}.`
          : 'Axios no recibió respuesta del servidor.';
      this.diagnostic.update((current) => ({
        ...current,
        status: 'error',
        httpStatus: axiosError?.response?.status ?? null,
        message: `${reason} Si no hay código HTTP, revisa que ambos equipos estén en la misma Wi-Fi, el acceso del firewall al puerto HTTP y los encabezados CORS de Apache/PHP.`,
        updatedAt: new Date().toISOString(),
      }));
      this.modalOpen.set(true);
    }
  }

  reportApplicationError(message: string): void {
    this.diagnostic.update((current) => ({
      ...current,
      status: 'error',
      message,
      updatedAt: new Date().toISOString(),
    }));
    this.modalOpen.set(true);
  }

  openModal(): void {
    this.modalOpen.set(true);
  }

  dismissModal(): void {
    this.modalOpen.set(false);
  }

  statusLabel(): string {
    const diagnostic = this.diagnostic();
    switch (diagnostic.status) {
      case 'unconfigured': return 'Sin configurar';
      case 'idle': return 'Pendiente de conexión';
      case 'connecting': return 'Conectando';
      case 'connected': return 'Conectado';
      case 'error': return 'Error de conexión';
    }
  }

  private getRequestUrl(config: { url?: string; baseURL?: string }): string {
    const fallback = typeof window !== 'undefined' ? window.location.origin : 'https://invalid.invalid';
    try {
      return new URL(config.url ?? '', config.baseURL ?? fallback).toString();
    } catch {
      return config.url ?? 'URL desconocida';
    }
  }

  private getHost(rawUrl: string): string {
    try {
      return new URL(rawUrl).host;
    } catch {
      return 'desconocido';
    }
  }

  private formatPayload(data: unknown): unknown {
    let payload = data;
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      const formPayload: Record<string, unknown> = {};
      Array.from(data.entries()).forEach(([key, value]) => {
        formPayload[key] = value instanceof File
          ? { name: value.name, type: value.type, size: value.size }
          : value;
      });
      payload = formPayload;
    } else if (typeof data === 'string') {
      try {
        payload = JSON.parse(data);
      } catch {
        if (data.includes('=')) {
          payload = Object.fromEntries(new URLSearchParams(data));
        } else {
          payload = data;
        }
      }
    }

    return this.maskSensitiveValues(payload ?? {});
  }

  private maskSensitiveValues(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.maskSensitiveValues(item));
    }
    if (value && typeof value === 'object') {
      return Object.entries(value).reduce<Record<string, unknown>>((masked, [key, item]) => {
        masked[key] = /password|passwd|token|secret|authorization/i.test(key)
          ? '[OCULTO]'
          : this.maskSensitiveValues(item);
        return masked;
      }, {});
    }
    return value;
  }
}