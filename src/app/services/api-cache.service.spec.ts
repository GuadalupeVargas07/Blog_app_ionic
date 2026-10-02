import { ApiCacheService } from './api-cache.service';
import { ApiConfigService } from './api-config.service';
import { StorageService } from './storage.service';

describe('ApiCacheService', () => {
  let cache: ApiCacheService;
  let values: Map<string, unknown>;

  beforeEach(() => {
    localStorage.clear();
    const apiConfig = new ApiConfigService();
    apiConfig.saveServerConfig({ protocol: 'http', host: '192.168.1.20', port: '8080' });
    values = new Map();
    const storage = {
      get: async (key: string) => values.get(key) ?? null,
      set: async (key: string, value: unknown) => { values.set(key, value); },
      remove: async (key: string) => { values.delete(key); },
    } as StorageService;
    cache = new ApiCacheService(storage, apiConfig);
  });

  it('returns and reports the last saved response when the API fails', async () => {
    const response = [{ id: 1, title: 'Entrada guardada' }];
    await cache.load('diary', 7, async () => response);
    cache.clearFallback();

    const result = await cache.load('diary', 7, async () => { throw new Error('offline'); });

    expect(result).toEqual(response);
    expect(cache.fallback()?.resources).toEqual(['diary']);
  });

  it('does not return cached data older than seven days', async () => {
    await cache.load('diary', 7, async () => ['saved']);
    const [[key, entry]] = Array.from(values.entries());
    values.set(key, { ...(entry as object), savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 });

    await expectAsync(cache.load('diary', 7, async () => { throw new Error('offline'); }))
      .toBeRejectedWithError('offline');
  });
});