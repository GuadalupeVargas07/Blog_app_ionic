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
    private authService: AuthService
  ) {}

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

onLogin(): void {
  console.log('🔵 onLogin() se ejecutó');

  if (!this.loginData.email || !this.loginData.password) {
    this.mostrarAlerta('Campos incompletos', 'Ingresa correo y contraseña');
    return;
  }

  const credentials = {
    email: this.loginData.email.trim(),
    password: this.loginData.password.trim()
  };

  this.authService.login(credentials).subscribe({
    next: (data: AuthResponse) => {
      console.log('✅ Respuesta recibida:', data); // <-- agrega esto
      if (data.status === 'success') {
        localStorage.setItem('user', JSON.stringify(data.user));
        console.log('➡️ Navegando a /tabs/tab1...'); // <-- agrega esto
        this.router.navigate(['/tabs', 'tab1']).then(ok => {
          console.log('Resultado navigate():', ok); // <-- agrega esto
        }).catch(err => {
          console.error('❌ Error en navigate():', err); // <-- agrega esto
        });
      } else {
        this.mostrarAlerta('Atención', data.message || 'Credenciales incorrectas');
      }
    },
    error: (error) => {
      console.error('❌ Error HTTP:', error); // <-- agrega esto
      this.mostrarAlerta('Error de inicio de sesión', 'No se pudo conectar con el servidor PHP (Revisa XAMPP o la URL)');
    }
  });
}

  onRegister(): void {
    if (!this.registerData.nombre) {
      this.mostrarAlerta('Atención', 'Ingresa tu nombre completo');
      return;
    }
    console.log('Datos listos para enviar a registro:', this.registerData);
    this.mostrarAlerta('Registro Exitoso', 'Tu usuario se ha creado correctamente');
    this.mode = 'login';
    this.currentStep = 1;
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