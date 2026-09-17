import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
  imagesOutline,
  locationOutline,
  menuOutline,
  personCircleOutline,
  sparklesOutline,
  planetOutline
} from 'ionicons/icons';
import { PhotoService } from '../services/photo.service';
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
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly router = inject(Router);

  // Endpoint base a tu API PHP en XAMPP
  private readonly apiUrl = 'http://localhost/API_aplicacion1/cuentas.php';

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

  activeTab = signal<'diario' | 'fotos' | 'animos'>('diario');
  coverPhoto = signal<string | null>(null);
  bio = signal<string>('');
  handle = computed(() => (this.usuario?.nombre ? `@${this.usuario.nombre.toLowerCase().replace(/\s+/g, '')}` : '@miPerfil'));
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
      'images-outline': imagesOutline,
      'location-outline': locationOutline,
      'sparkles-outline': sparklesOutline,
      'planet-outline': planetOutline,
    });
  }

  ngOnInit(): void {
    this.cargarUsuario();
    this.coverPhoto.set(localStorage.getItem('coverPhoto'));
    this.bio.set(this.usuario?.bio ?? '');
  }

  ionViewWillEnter(): void {
    this.cargarUsuario();
  }

  cargarUsuario(): void {
    const userData = localStorage.getItem('user');
    this.usuario = userData ? JSON.parse(userData) : null;
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
      
      if (response.data && response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
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
      header: header,
      message: message,
      buttons: ['Aceptar']
    });
    await alert.present();
  }

  async showModalSuccess(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['Continuar']
    });
    await alert.present();
  }

  // ================= MÉTODOS EXISTENTES =================

  openMenu(): void {
    this.comingSoon('Menú');
  }

  editarPerfil(): void {
    this.comingSoon('Editar perfil');
  }

  editarFotoPerfil(): void {
    this.comingSoon('Cambiar foto de perfil');
  }

  editarPortada(): void {
    this.comingSoon('Editar portada');
  }

  setActiveTab(tab: 'diario' | 'fotos' | 'animos'): void {
    this.activeTab.set(tab);
  }

  logout(): void {
    localStorage.removeItem('user');
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