import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  ToastController,
  AlertController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  bookOutline,
  cameraOutline,
  createOutline,
  homeOutline,
  imagesOutline,
  locationOutline,
  logOutOutline,
  menuOutline,
  personCircleOutline,
  sparklesOutline,
  planetOutline
} from 'ionicons/icons';
import { PhotoService } from '../services/photo.service';
import { StorageService } from '../services/storage.service';
import axios from 'axios';

@Component({
  selector: 'app-tab1',
  templateUrl: './tab1.page.html',
  styleUrls: ['./tab1.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonIcon,
  ],
})
export class Tab1Page implements OnInit {
  public photoService = inject(PhotoService);
  private readonly storageService = inject(StorageService);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly router = inject(Router);

  // Endpoint base a tu API PHP en XAMPP
  private readonly apiUrl = 'http://localhost/API_aplicacion1/cuentas.php';
  // Endpoint para subir imágenes (perfil / portada) a la carpeta /uploads de la API
  private readonly uploadUrl = 'http://localhost/API_aplicacion1/upload.php';

  // Referencias a los <input type="file"> ocultos (se disparan por click)
  @ViewChild('fotoPerfilInput') fotoPerfilInput?: ElementRef<HTMLInputElement>;
  @ViewChild('fotoPortadaInput') fotoPortadaInput?: ElementRef<HTMLInputElement>;

  subiendoFoto = signal<boolean>(false);
  menuOpen = signal<boolean>(false);

  mode: 'login' | 'register' = 'login';
  currentStep: number = 1;

  loginData = {
    email: '',
    password: ''
  };

  registerData = {
    email: '',
    password: '',
    nombre: ''
  };

  usuario: any = null;
  nombreUsuario: string = '';

  activeTab = signal<'diario' | 'fotos' | 'animos'>('diario');
  coverPhoto = signal<string | null>(null);
  bio = signal<string>('');
  handle = computed(() => {
    const alias = this.usuario?.username || this.usuario?.nombre;
    if (!alias) {
      return '@miPerfil';
    }
    return `@${String(alias).toLowerCase().replace(/\s+/g, '')}`;
  });
  intereses = signal<string[]>(['Viajes', 'Fotografía', 'Café']);
  notas = signal<number>(0);
  animos = signal<number>(0);
  fotosCount = computed(() => this.photoService.photos().length);

  constructor() {
    addIcons({
      'menu-outline': menuOutline,
      'person-circle-outline': personCircleOutline,
      'camera-outline': cameraOutline,
      'create-outline': createOutline,
      'book-outline': bookOutline,
      'home-outline': homeOutline,
      'images-outline': imagesOutline,
      'location-outline': locationOutline,
      'log-out-outline': logOutOutline,
      'sparkles-outline': sparklesOutline,
      'planet-outline': planetOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    this.cargarUsuario();
    await this.cargarUsuarioPersistido();
    await this.refrescarPerfilDesdeServidor();
  }

  ionViewWillEnter(): void {
    this.cargarUsuario();
  }

  async cargarUsuarioPersistido(): Promise<void> {
    const usuarioGuardado = await this.storageService.get('usuario');

    if (usuarioGuardado) {
      this.nombreUsuario = typeof usuarioGuardado === 'string' ? usuarioGuardado : String(usuarioGuardado);
      const usuarioActual = this.usuario ?? {};
      this.usuario = { ...usuarioActual, nombre: this.nombreUsuario || usuarioActual.nombre };
      localStorage.setItem('user', JSON.stringify(this.usuario));
      console.log('Dato recuperado de la persistencia local:', this.nombreUsuario);
    }
  }

  async guardarDato(): Promise<void> {
    await this.storageService.set('usuario', this.nombreUsuario);
    console.log('Dato guardado localmente');
  }

  private async refrescarPerfilDesdeServidor(): Promise<void> {
    const usuarioGuardado = localStorage.getItem('user');
    const userId = usuarioGuardado ? JSON.parse(usuarioGuardado)?.id : this.usuario?.id;

    if (!userId) {
      return;
    }

    try {
      const response = await axios.get(`${this.apiUrl}?action=get_profile&id=${userId}`);
      const perfilActualizado = response.data?.user ?? response.data ?? null;

      if (!perfilActualizado) {
        return;
      }

      const usuarioMerge = {
        ...(usuarioGuardado ? JSON.parse(usuarioGuardado) : this.usuario ?? {}),
        ...perfilActualizado,
      };

      this.usuario = usuarioMerge;
      localStorage.setItem('user', JSON.stringify(usuarioMerge));
      this.cargarUsuario();
    } catch {
      // Si el backend no expone el endpoint, dejamos el usuario local actual.
    }
  }

  private normalizarIntereses(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
      if (!value.trim()) {
        return [];
      }

      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        return value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    return [];
  }

  cargarUsuario(): void {
    const userData = localStorage.getItem('user');
    this.usuario = userData ? JSON.parse(userData) : null;

    if (this.usuario) {
      this.bio.set(this.usuario.bio ?? '');
      this.coverPhoto.set(this.usuario.foto_portada || localStorage.getItem('coverPhoto'));
      this.intereses.set(this.normalizarIntereses(this.usuario.intereses));
    } else {
      this.bio.set('');
      this.coverPhoto.set(localStorage.getItem('coverPhoto'));
      this.intereses.set(['Viajes', 'Fotografía', 'Café']);
    }
  }

  // ================= LÓGICA DE REGISTRO / LOGIN CON AXIOS =================

  nextStep(): void {
    if (this.currentStep === 1 && (!this.registerData.email || !this.registerData.password)) {
      this.showModalError('Campos requeridos', 'Por favor ingresa tu correo y contraseña.');
      return;
    }
    if (this.currentStep === 2 && !this.registerData.nombre) {
      this.showModalError('Campo requerido', 'Por favor escribe tu nombre completo.');
      return;
    }
    if (this.currentStep < 3) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  // POST con Axios -> Login
  async onLogin(): Promise<void> {
    if (!this.loginData.email || !this.loginData.password) {
      this.showModalError('Campos vacíos', 'Ingresa tu correo y contraseña para continuar.');
      return;
    }

    try {
      const response = await axios.post(`${this.apiUrl}?action=login`, this.loginData);
      const userLogin = response.data?.user ?? null;

      if (userLogin) {
        const userId = userLogin.id;
        const userActual = userId ? (await axios.get(`${this.apiUrl}?action=get_profile&id=${userId}`)).data?.user ?? userLogin : userLogin;
        localStorage.setItem('user', JSON.stringify(userActual));
        this.usuario = userActual;
        this.cargarUsuario();
      }

      this.showModalSuccess('¡Bienvenido!', response.data.message || 'Inicio de sesión correcto.');
    } catch (error: any) {
      this.handleAxiosError(error);
    }
  }

  // POST con Axios -> Registro
  async onRegister(): Promise<void> {
    if (!this.registerData.email || !this.registerData.password || !this.registerData.nombre) {
      this.showModalError('Datos incompletos', 'Asegúrate de haber llenado todos los campos del registro.');
      return;
    }

    try {
      // Envía la petición apuntando explícitamente a ?action=register
      const response = await axios.post(`${this.apiUrl}?action=register`, this.registerData);
      
      this.showModalSuccess('Registro completado', response.data.message || 'Tu cuenta ha sido creada con éxito.');
      
      // Reiniciar vista al formulario de login
      this.mode = 'login';
      this.currentStep = 1;
      this.registerData = { email: '', password: '', nombre: '' };
    } catch (error: any) {
      this.handleAxiosError(error);
    }
  }

  // Manejo de errores de Axios en Modal
  private handleAxiosError(error: any): void {
    let message = 'No se pudo conectar con el servidor. Revisa tu conexión.';
    
    if (error.response && error.response.data && error.response.data.message) {
      message = error.response.data.message;
    } else if (error.message) {
      message = error.message;
    }

    this.showModalError('Error de servidor', message);
  }

  async showModalError(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      cssClass: 'perfil-modal perfil-modal--simple',
      header,
      message,
      buttons: [{ text: 'Aceptar', cssClass: 'perfil-modal__button perfil-modal__button--primary' }],
    });
    await alert.present();
  }

  async showModalSuccess(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      cssClass: 'perfil-modal perfil-modal--simple',
      header,
      message,
      buttons: [{ text: 'Continuar', cssClass: 'perfil-modal__button perfil-modal__button--primary' }],
    });
    await alert.present();
  }

private async guardarPerfilEnApi(payload: Record<string, any>): Promise<void> {
  if (!this.usuario?.id) {
    return;
  }

  const payloadFinal: Record<string, any> = {
    ...payload,
    id: this.usuario.id,
  };

  if (payloadFinal['username'] === this.usuario.username) {
    delete payloadFinal['username'];
  }

  if (payloadFinal['foto_perfil']) {
    payloadFinal['foto'] = payloadFinal['foto_perfil'];
  }

  if (payloadFinal['foto_portada']) {
    payloadFinal['portada'] = payloadFinal['foto_portada'];
  }

  try {
    const response = await axios.post(
      `${this.apiUrl}?action=update_profile&id=${this.usuario.id}`,
      payloadFinal,
      { headers: { 'Content-Type': 'application/json' } }
    );

    const updatedUser = response.data?.user ?? { ...this.usuario, ...payloadFinal };
    const mergedUser = {
      ...this.usuario,
      ...updatedUser,
      ...payloadFinal,
    };

    this.usuario = mergedUser;
    localStorage.setItem('user', JSON.stringify(mergedUser));
    this.cargarUsuario();
  } catch (error: any) {
    const errorMsg = error?.response?.data?.message || error.message;
    console.warn('No se pudo guardar el perfil en la API:', errorMsg);
    this.showModalError('Error al guardar', errorMsg);
  }
}

  // ================= MÉTODOS EXISTENTES =================

  guardarPerfil(data: {
    nombre?: string;
    bio?: string;
    intereses?: string[];
    foto_perfil?: string;
    foto_portada?: string;
    foto?: string;
    portada?: string;
  }): void {
    const user = this.usuario ?? { id: null, nombre: '', username: '', email: '' };

    const nombre = (data.nombre ?? user.nombre ?? '').trim();
    const bio = (data.bio ?? user.bio ?? '').trim();
    const intereses = this.normalizarIntereses(data.intereses ?? user.intereses ?? this.intereses());
    const fotoPerfil = (data.foto_perfil ?? data.foto ?? user.foto_perfil ?? user.foto ?? '').trim();
    const portada = (data.foto_portada ?? data.portada ?? user.foto_portada ?? user.portada ?? localStorage.getItem('coverPhoto') ?? '').trim();

    const perfilActualizado = {
      ...user,
      nombre: nombre || user.nombre || 'Mi perfil',
      username: user.username || this.handle().replace('@', '') || 'miPerfil',
      bio,
      foto_perfil: fotoPerfil || null,
      foto: fotoPerfil || null,
      foto_portada: portada || null,
      portada: portada || null,
      intereses,
    };

    this.usuario = perfilActualizado;
    localStorage.setItem('user', JSON.stringify(perfilActualizado));
    void this.storageService.set('user', perfilActualizado);
    if (this.usuario?.nombre) {
      void this.storageService.set('usuario', this.usuario.nombre);
    }

    if (portada) {
      localStorage.setItem('coverPhoto', portada);
      this.coverPhoto.set(portada);
    } else {
      this.coverPhoto.set(null);
    }

    this.bio.set(bio);
    this.intereses.set(intereses);

    if (this.usuario?.id) {
      const payload: Record<string, any> = {
        nombre: perfilActualizado.nombre,
        bio: perfilActualizado.bio,
        foto_perfil: perfilActualizado.foto_perfil,
        foto_portada: perfilActualizado.foto_portada,
        intereses: perfilActualizado.intereses,
      };

      void this.guardarPerfilEnApi(payload);
    }
  }

  async editarPerfil(): Promise<void> {
    const alert = await this.alertController.create({
      cssClass: 'perfil-modal perfil-modal--large',
      header: 'Editar perfil',
      subHeader: 'Actualiza tu nombre, bio e intereses',
      inputs: [
        {
          name: 'nombre',
          type: 'text',
          value: this.usuario?.nombre ?? '',
          placeholder: 'Nombre completo',
        },
        {
          name: 'bio',
          type: 'text',
          value: this.bio() ?? '',
          placeholder: 'Frase sobre ti',
        },
        {
          name: 'intereses',
          type: 'text',
          value: this.intereses().join(', '),
          placeholder: 'Viajes, Fotografía, Café',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'perfil-modal__button perfil-modal__button--cancel',
        },
        {
          text: 'Guardar',
          cssClass: 'perfil-modal__button perfil-modal__button--primary',
          handler: (data) => {
            const nombre = data.nombre?.trim();
            const bio = data.bio?.trim();
            const intereses = (data.intereses ?? '')
              .split(',')
              .map((item: string) => item.trim())
              .filter(Boolean);

            this.guardarPerfil({
              nombre: nombre || this.usuario?.nombre,
              bio: bio || '',
              intereses: intereses.length > 0 ? intereses : this.intereses(),
            });

            this.showModalSuccess('Perfil actualizado', 'Los cambios se guardaron correctamente.');
          },
        },
      ],
    });

    await alert.present();
  }

  // ================= SELECCIÓN Y SUBIDA DE FOTOS (perfil / portada) =================

  // Abre el explorador de archivos del equipo para la foto de perfil
  editarFotoPerfil(): void {
    if (this.subiendoFoto()) {
      return;
    }
    this.fotoPerfilInput?.nativeElement.click();
  }

  // Abre el explorador de archivos del equipo para la portada
  editarPortada(): void {
    if (this.subiendoFoto()) {
      return;
    }
    this.fotoPortadaInput?.nativeElement.click();
  }

  // Se dispara cuando el usuario elige un archivo en el <input type="file"> de perfil
  async onFotoPerfilSeleccionada(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    input.value = ''; // permite volver a elegir el mismo archivo más adelante
    if (!file) {
      return;
    }
    await this.subirYGuardarImagen(file, 'perfil');
  }

  // Se dispara cuando el usuario elige un archivo en el <input type="file"> de portada
  async onFotoPortadaSeleccionada(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    input.value = '';
    if (!file) {
      return;
    }
    await this.subirYGuardarImagen(file, 'portada');
  }

  // Sube la imagen (FormData) al endpoint PHP upload.php mediante Axios.
  // El backend la guarda físicamente en API_aplicacion1/uploads/ y actualiza
  // el link en la base de datos; aquí solo sincronizamos el estado local.
  private async subirYGuardarImagen(file: File, tipo: 'perfil' | 'portada'): Promise<void> {
    if (!this.usuario?.id) {
      this.showModalError('Sesión requerida', 'Inicia sesión para poder cambiar tus fotos.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.showModalError('Archivo inválido', 'Selecciona un archivo de imagen (jpg, png, webp o gif).');
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxBytes) {
      this.showModalError('Imagen muy pesada', 'La imagen no debe superar los 5 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('imagen', file);
    formData.append('id', String(this.usuario.id));
    formData.append('tipo', tipo);

    this.subiendoFoto.set(true);
    try {
      // No fijamos el header Content-Type a propósito: el navegador/Axios
      // arma automáticamente el boundary correcto para multipart/form-data.
      const response = await axios.post(this.uploadUrl, formData);
      const url: string | undefined = response.data?.url;

      if (!url) {
        throw new Error('La API no devolvió la URL de la imagen subida');
      }

      if (tipo === 'perfil') {
        this.guardarPerfil({ foto_perfil: url });
        this.showModalSuccess('Foto actualizada', 'La foto de perfil se ha guardado.');
      } else {
        this.guardarPerfil({ foto_portada: url });
        this.showModalSuccess('Portada actualizada', 'La imagen de portada se ha guardado.');
      }
    } catch (error: any) {
      this.handleAxiosError(error);
    } finally {
      this.subiendoFoto.set(false);
    }
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  goToHome(): void {
    this.closeMenu();
    this.router.navigate(['/hm']);
  }

  setActiveTab(tab: 'diario' | 'fotos' | 'animos'): void {
    this.activeTab.set(tab);
  }

  logout(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('coverPhoto');
    this.closeMenu();
    this.router.navigate(['/login']);
  }

  async comingSoon(feature: string): Promise<void> {
    const toast = await this.toastController.create({
      message: `${feature}: disponible muy pronto ✨`,
      duration: 1800,
      position: 'bottom',
      color: 'dark',
    });
    await toast.present();
  }
}