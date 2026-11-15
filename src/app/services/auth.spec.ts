import { TestBed } from '@angular/core/testing';
import axios from 'axios';
import { AuthService } from './auth';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('api_server_config', JSON.stringify({
      protocol: 'http',
      host: '192.168.1.66',
      port: '80',
    }));
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('sends login credentials as URL-encoded form data through Axios', async () => {
    const responseData = { status: 'success' };
    const post = spyOn(axios, 'post').and.returnValue(Promise.resolve({ data: responseData } as never));

    await expectAsync(service.login({ email: 'ana@example.com', password: 'pass123' }))
      .toBeResolvedTo(responseData);

    expect(post).toHaveBeenCalledWith(
      'http://192.168.1.66/API_aplicacion1/login.php',
      jasmine.any(URLSearchParams),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' } },
    );
    const requestBody = post.calls.mostRecent().args[1] as URLSearchParams;
    expect(requestBody.get('email')).toBe('ana@example.com');
    expect(requestBody.get('password')).toBe('pass123');
  });
});
