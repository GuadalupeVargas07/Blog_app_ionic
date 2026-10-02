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

  constructor(apiConfig: ApiConfigService) {
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
        payload = data;
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