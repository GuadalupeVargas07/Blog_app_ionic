import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonInput,
  IonButton,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  AlertController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  planetOutline,
  serverOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth';
import { ApiConfigService } from '../services/api-config.service';
import { ApiDiagnosticsService } from '../services/api-diagnostics.service';

// 1. Definición de la interfaz para tipar la respuesta de PHP
interface AuthResponse {
  status: string;
  message?: string;
  user?: {
    id: number;
    nombre: string;
    email: string;
  };
}

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    IonContent, 
    IonInput, 
    IonButton, 
    IonSegment, 
    IonSegmentButton, 
    IonLabel, 
    IonIcon,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
  ]
})
export class LoginPage {
  mode: 'login' | 'register' = 'login';
  currentStep: number = 1;
  serverOrigin = '';
  probandoConexion = false;

  loginData = {
    email: '',
    password: ''
  };

  registerData = {
    email: '',
    password: '',
    nombre: ''
  };

  constructor(
    private router: Router,
    private alertController: AlertController,
    private authService: AuthService,
    private apiConfig: ApiConfigService,
    readonly apiDiagnostics: ApiDiagnosticsService,
  ) {
    addIcons({
      planetOutline,
      serverOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
    });

    const saved = this.apiConfig.getServerOriginInput();
    if (saved) {
      this.serverOrigin = saved;
    } else {
      this.serverOrigin = 'http://192.168.1.66:80';
      try {
        this.apiConfig.setServerOrigin(this.serverOrigin);
      } catch {
        // Fallback silencioso si el almacenamiento local aún no está disponible
      }
    }
  }

  normalizarOrigen(raw: string): { origin: string; nota?: string } {
    let val = (raw || '').trim();
    if (!val) {
      val = '192.168.1.66:80';
    }

    let nota: string | undefined;

    // Detectar si el usuario especificó el puerto 3306 de MySQL
    if (/:3306(\b|\/)/.test(val)) {
      val = val.replace(/:3306(\b|\/)/, ':80$1');
      nota = 'Detectado puerto 3306 (MySQL). Las APIs de la laptop responden en el puerto HTTP 80 de Apache y se comunican internamente con tu base de datos MySQL (puerto 3306). Se configuró el puerto 80 para las peticiones de la app móvil.';
    }

    // Quitar /API_aplicacion1 si el usuario lo incluyó manualmente
    val = val.replace(/\/API_aplicacion1\/?$/i, '');
    val = val.replace(/\/+$/, '');

    // Si solo puso una IP o hostname sin protocolo, ej: "192.168.1.66" o "192.168.1.66:80"
    if (!/^https?:\/\//i.test(val)) {
      if (!val.includes(':')) {
        val = `${val}:80`;
      }
      val = `http://${val}`;
    }

    return { origin: val, nota };
  }

  async guardarServidor(): Promise<void> {
    try {
      const { origin, nota } = this.normalizarOrigen(this.serverOrigin);
      this.serverOrigin = origin;
      this.apiConfig.setServerOrigin(this.serverOrigin);
      this.serverOrigin = this.apiConfig.getServerOriginInput();

      const mensaje = nota
        ? `${nota}\n\nLas pantallas del proyecto se conectarán a esta IP dinámica.`
        : 'Origen de datos guardado. Las pantallas del proyecto se conectarán a esta IP dinámica y accederán a tu base de datos MySQL.';
      await this.mostrarAlerta('Servidor guardado', mensaje);
    } catch (error: any) {
      await this.mostrarAlerta('Dirección inválida', error?.message ?? 'Revisa la IP y el puerto.');
    }
  }

  async probarConexion(): Promise<void> {
    try {
      const { origin, nota } = this.normalizarOrigen(this.serverOrigin);
      this.serverOrigin = origin;
      this.apiConfig.setServerOrigin(this.serverOrigin);
      this.serverOrigin = this.apiConfig.getServerOriginInput();
      this.probandoConexion = true;
      await this.apiDiagnostics.testConnection();

      const diag = this.apiDiagnostics.diagnostic();
      if (diag.status === 'connected') {
        const mensajeExito = (nota ? `${nota}\n\n` : '') +
          `¡Conexión exitosa con ${diag.host || this.serverOrigin}! La API de tu laptop respondió y tiene acceso a la base de datos MySQL.`;
        await this.mostrarAlerta('Conexión exitosa', mensajeExito);
      } else if (diag.status === 'error') {
        await this.mostrarAlerta('Error de conexión', diag.message);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Revisa la IP y el puerto HTTP.';
      await this.mostrarAlerta('Dirección inválida', message);
    } finally {
      this.probandoConexion = false;
    }
  }

  abrirOrigenDatos(): void {
    void this.router.navigate(['/data-source']);
  }

  nextStep(): void {
    if (this.currentStep === 1 && (!this.registerData.email || !this.registerData.password)) {
      this.mostrarAlerta('Atención', 'Ingresa tu correo y contraseña');
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

  async onLogin(): Promise<void> {
    if (!this.loginData.email || !this.loginData.password) {
      await this.mostrarAlerta('Campos incompletos', 'Ingresa correo y contraseña');
      return;
    }

    const credentials = {
      email: this.loginData.email.trim(),
      password: this.loginData.password.trim(),
    };

    try {
      const { origin } = this.normalizarOrigen(this.serverOrigin);
      this.serverOrigin = origin;
      this.apiConfig.setServerOrigin(this.serverOrigin);
      this.serverOrigin = this.apiConfig.getServerOriginInput();

      const data = await this.authService.login(credentials);
      const status = data?.status ?? (data?.success === true ? 'success' : 'error');
      const user = data?.user ?? null;
      const message = data?.message ?? 'Credenciales incorrectas';

      if (status === 'success' || data?.success === true) {
        if (user) {
          const usuarioFinal = await this.syncUserFromServer(user);
          if (usuarioFinal?.id || usuarioFinal?.email) {
            localStorage.setItem('user', JSON.stringify(usuarioFinal));
          }
        }

        this.router.navigate(['/tabs', 'tab1']);
      } else {
        this.apiDiagnostics.reportApplicationError(message);
        await this.mostrarAlerta('Error de inicio de sesión', message);
      }
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message ?? error?.message ?? 'No se pudo conectar con el servidor PHP';
      this.apiDiagnostics.reportApplicationError(backendMessage);
      await this.mostrarAlerta('Error de conexión', `${backendMessage}\n\nVerifica que tu celular y laptop estén en la misma red Wi-Fi y que la IP (${this.serverOrigin}) sea accesible.`);
    }
  }

  async onRegister(): Promise<void> {
    if (!this.registerData.email || !this.registerData.password || !this.registerData.nombre) {
      await this.mostrarAlerta('Atención', 'Ingresa correo, contraseña y nombre completo');
      return;
    }

    const payload = {
      email: this.registerData.email.trim(),
      password: this.registerData.password.trim(),
      nombre: this.registerData.nombre.trim(),
    };

    try {
      const { origin } = this.normalizarOrigen(this.serverOrigin);
      this.serverOrigin = origin;
      this.apiConfig.setServerOrigin(this.serverOrigin);
      this.serverOrigin = this.apiConfig.getServerOriginInput();

      const registerResponse = await this.authService.register(payload);
      const message = registerResponse?.message || 'Tu usuario se ha creado correctamente';

      try {
        const loginResponse = await this.authService.login({
          email: payload.email,
          password: payload.password,
        });

        const user = loginResponse?.user ?? {
          email: payload.email,
          nombre: payload.nombre,
        };

        if (user) {
          const usuarioFinal = await this.syncUserFromServer(user);
          localStorage.setItem('user', JSON.stringify(usuarioFinal));
        }
      } catch {
        // Si el login inmediato falla, lo dejamos igual con el registro válido
      }

      this.mode = 'login';
      this.currentStep = 1;
      this.registerData = { email: '', password: '', nombre: '' };

      this.router.navigate(['/tabs', 'tab1']);
      await this.mostrarAlerta('Registro exitoso', message);
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message ?? error?.message ?? 'No se pudo registrar el usuario';
      this.apiDiagnostics.reportApplicationError(backendMessage);
      await this.mostrarAlerta('Error en registro', `${backendMessage}\n\nVerifica que tu celular y laptop estén en la misma red Wi-Fi y que la IP (${this.serverOrigin}) sea accesible.`);
    }
  }
  private async syncUserFromServer(user: any): Promise<any> {
    const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
    const fallbackId = user?.id ?? storedUser?.id ?? null;

    if (!fallbackId) {
      return {
        ...(storedUser ?? {}),
        ...(user ?? {}),
        email: user?.email ?? storedUser?.email ?? '',
        nombre: user?.nombre ?? storedUser?.nombre ?? '',
      };
    }

    try {
      const data = await this.authService.getProfile(fallbackId);
      const fullUser = data?.user ?? data ?? {};

      return {
        ...(storedUser ?? {}),
        ...(user ?? {}),
        ...(fullUser ?? {}),
        id: fullUser.id ?? user.id ?? storedUser?.id ?? fallbackId,
        email: fullUser.email ?? user.email ?? storedUser?.email ?? '',
        nombre: fullUser.nombre ?? user.nombre ?? storedUser?.nombre ?? '',
      };
    } catch {
      return {
        ...(storedUser ?? {}),
        ...(user ?? {}),
        id: user.id ?? storedUser?.id ?? fallbackId,
        email: user.email ?? storedUser?.email ?? '',
        nombre: user.nombre ?? storedUser?.nombre ?? '',
      };
    }
  }
  async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
  
}