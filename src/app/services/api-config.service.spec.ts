import { ApiConfigService } from './api-config.service';

describe('ApiConfigService', () => {
  let service: ApiConfigService;

  beforeEach(() => {
    localStorage.clear();
    service = new ApiConfigService();
  });

  it('persists the server as JSON and builds the API URL from it', () => {
    service.saveServerConfig({ protocol: 'http', host: '192.168.1.45', port: '8080' });

    expect(JSON.parse(localStorage.getItem('api_server_config') ?? '{}')).toEqual({
      protocol: 'http',
      host: '192.168.1.45',
      port: '8080',
    });
    expect(service.getApiBaseUrl()).toBe('http://192.168.1.45:8080/API_aplicacion1');
  });

  it('does not default to localhost when no server is saved', () => {
    expect(() => service.getApiBaseUrl()).toThrowError(/Configura la IP/);
  });

  it('rejects the MySQL port as an API port', () => {
    expect(() => service.saveServerConfig({ protocol: 'http', host: '192.168.1.45', port: '3306' }))
      .toThrowError(/puerto de MySQL/);
  });

  it('rewrites localhost image URLs to the configured server', () => {
    service.saveServerConfig({ protocol: 'http', host: '192.168.1.45', port: '8080' });

    expect(service.resolveAssetUrl('http://localhost/API_aplicacion1/uploads/photo.jpg'))
      .toBe('http://192.168.1.45:8080/API_aplicacion1/uploads/photo.jpg');
  });
});