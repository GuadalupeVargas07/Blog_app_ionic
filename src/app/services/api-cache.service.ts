import { Injectable, signal } from '@angular/core';
import { ApiConfigService } from './api-config.service';
import { StorageService } from './storage.service';

interface ApiCacheEntry<T> {
  value: T;
  savedAt: number;
}

export interface ApiCacheFallback {
  resources: string[];
  savedAt: number;
}

@Injectable({ providedIn: 'root' })
export class ApiCacheService {
  private readonly maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  private readonly resources = ['diary', 'captures', 'moods'];
  readonly fallback = signal<ApiCacheFallback | null>(null);

  constructor(
    private readonly storage: StorageService,
    private readonly apiConfig: ApiConfigService,
  ) {}

  async load<T>(resource: string, userId: number, request: () => Promise<T>): Promise<T> {
    const key = this.cacheKey(resource, userId);
    try {
      const value = await request();
      try {
        await this.storage.set(key, { value, savedAt: Date.now() } satisfies ApiCacheEntry<T>);
      } catch {
        // A cache write failure must not turn a successful API read into an error.
      }
      return value;
    } catch (error) {
      let cached: ApiCacheEntry<T> | null = null;
      try {
        cached = await this.storage.get(key) as ApiCacheEntry<T> | null;
      } catch {
        cached = null;
      }

      if (cached && typeof cached.savedAt === 'number' && Date.now() - cached.savedAt <= this.maxAgeMs) {
        this.fallback.update((current) => ({
          resources: current?.resources.includes(resource)
            ? current.resources
            : [...(current?.resources ?? []), resource],
          savedAt: Math.min(current?.savedAt ?? cached!.savedAt, cached!.savedAt),
        }));
        return cached.value;
      }

      throw error;
    }
  }

  clearFallback(): void {
    this.fallback.set(null);
  }

  fallbackMessage(): string | null {
    const fallback = this.fallback();
    if (!fallback) {
      return null;
    }

    const labels: Record<string, string> = {
      diary: 'diario',
      captures: 'fotos',
      moods: 'ánimos',
    };
    const resources = fallback.resources.map((resource) => labels[resource] ?? resource).join(', ');
    return `Sin conexión: mostrando datos guardados de ${resources} (${new Date(fallback.savedAt).toLocaleString()}).`;
  }

  async invalidateUser(userId: number): Promise<void> {
    await Promise.all(this.resources.map(async (resource) => {
      try {
        await this.storage.remove(this.cacheKey(resource, userId));
      } catch {
        // Cache invalidation is best-effort; the server mutation already succeeded.
      }
    }));
  }

  private cacheKey(resource: string, userId: number): string {
    return `api_cache_v1_${encodeURIComponent(this.apiConfig.getApiBaseUrl())}_${resource}_${userId}`;
  }
}