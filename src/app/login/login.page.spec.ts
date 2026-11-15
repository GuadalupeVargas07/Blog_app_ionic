import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('normalizes IP without port to port 80', () => {
    const res = component.normalizarOrigen('192.168.1.66');
    expect(res.origin).toBe('http://192.168.1.66:80');
  });

  it('redirects MySQL port 3306 to HTTP port 80 with explanation note', () => {
    const res = component.normalizarOrigen('192.168.1.66:3306');
    expect(res.origin).toBe('http://192.168.1.66:80');
    expect(res.nota).toContain('3306');
  });

  it('cleans /API_aplicacion1 from origin input', () => {
    const res = component.normalizarOrigen('http://192.168.1.66:80/API_aplicacion1');
    expect(res.origin).toBe('http://192.168.1.66:80');
  });

  it('provides default laptop IP 192.168.1.66 when empty', () => {
    const res = component.normalizarOrigen('');
    expect(res.origin).toBe('http://192.168.1.66:80');
  });
});
