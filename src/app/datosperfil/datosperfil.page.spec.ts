import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular, ToastController } from '@ionic/angular';
import { DatosperfilPage } from './datosperfil.page';

describe('DatosperfilPage', () => {
  let component: DatosperfilPage;
  let fixture: ComponentFixture<DatosperfilPage>;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({
      nombre: 'Ana',
      username: 'ana',
      email: 'ana@example.com',
      bio: 'Me gusta viajar',
      intereses: ['Viajes', 'Café'],
    }));

    await TestBed.configureTestingModule({
      imports: [DatosperfilPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: ToastController,
          useValue: {
            create: async () => ({ present: async () => undefined }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DatosperfilPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the saved profile and normalizes interests', () => {
    expect(component.usuario.nombre).toBe('Ana');
    expect(component.usuario.intereses).toEqual(['Viajes', 'Café']);
  });

  it('saves profile details locally when there is no server user id', async () => {
    component.usuario.nombre = 'Ana García';
    component.usuario.bio = 'Fotógrafa';

    await component.guardarCambios();

    const savedUser = JSON.parse(localStorage.getItem('user') ?? '{}');
    expect(savedUser.nombre).toBe('Ana García');
    expect(savedUser.bio).toBe('Fotógrafa');
    expect(savedUser.intereses).toEqual(['Viajes', 'Café']);
  });

});
