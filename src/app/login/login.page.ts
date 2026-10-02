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
  AlertController,
} from '@ionic/angular';
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
    IonIcon
  ]
})
export class LoginPage {
  mode: 'login' | 'register' = 'login';
  currentStep: number = 1;
  serverOrigin = '';

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
    this.serverOrigin = this.apiConfig.getServerOriginInput();
  }

  async guardarServidor(): Promise<void> {
    try {
      this.apiConfig.setServerOrigin(this.serverOrigin);
      this.serverOrigin = this.apiConfig.getServerOriginInput();
      await this.mostrarAlerta('Servidor guardado', 'Las pantallas usarán esta dirección para conectarse a la API.');
    } catch (error: any) {
      await this.mostrarAlerta('Dirección inválida', error?.message ?? 'Revisa la IP y el puerto HTTP.');
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
      this.mostrarAlerta('Campos incompletos', 'Ingresa correo y contraseña');
      return;
    }

    const credentials = {
      email: this.loginData.email.trim(),
      password: this.loginData.password.trim(),
    };

    try {
      this.apiConfig.setServerOrigin(this.serverOrigin);
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
      }
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message ?? error?.message ?? 'No se pudo conectar con el servidor PHP';
      this.apiDiagnostics.reportApplicationError(backendMessage);
    }
  }

  async onRegister(): Promise<void> {
    if (!this.registerData.email || !this.registerData.password || !this.registerData.nombre) {
      this.mostrarAlerta('Atención', 'Ingresa correo, contraseña y nombre completo');
      return;
    }

    const payload = {
      email: this.registerData.email.trim(),
      password: this.registerData.password.trim(),
      nombre: this.registerData.nombre.trim(),
    };

    try {
      this.apiConfig.setServerOrigin(this.serverOrigin);
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
      this.mostrarAlerta('Registro exitoso', message);
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message ?? error?.message ?? 'No se pudo registrar el usuario';
      this.apiDiagnostics.reportApplicationError(backendMessage);
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