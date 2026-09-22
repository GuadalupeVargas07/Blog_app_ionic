import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';

import { Tab1Page } from './tab1.page';

describe('Tab1Page', () => {
  let component: Tab1Page;
  let fixture: ComponentFixture<Tab1Page>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tab1Page],
      providers: [provideZonelessChangeDetection(), provideIonicAngular()],
    }).compileComponents();

    localStorage.clear();
    fixture = TestBed.createComponent(Tab1Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should save the edited profile data in localStorage', () => {
    component.usuario = { id: 1, nombre: 'Ana', email: 'ana@test.com' };

    component.guardarPerfil({
      nombre: 'Ana García',
      bio: 'Fotógrafa viajera',
      intereses: ['Viajes', 'Café', 'Naturaleza'],
      foto: 'https://example.com/avatar.png',
      portada: 'https://example.com/cover.png'
    });

    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');

    expect(storedUser.nombre).toBe('Ana García');
    expect(storedUser.bio).toBe('Fotógrafa viajera');
    expect(storedUser.foto).toBe('https://example.com/avatar.png');
    expect(storedUser.portada).toBe('https://example.com/cover.png');
    expect(component.bio()).toBe('Fotógrafa viajera');
    expect(component.intereses()).toEqual(['Viajes', 'Café', 'Naturaleza']);
  });
});
