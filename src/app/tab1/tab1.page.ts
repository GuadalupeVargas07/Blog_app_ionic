import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonButton, AlertController } from '@ionic/angular';
import { ExploreContainerComponent } from '../explore-container/explore-container.component';
import { addIcons } from 'ionicons';
import { planetOutline } from 'ionicons/icons';
import axios from 'axios';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonButton,
    ExploreContainerComponent,
  ],
})
export class Tab1Page implements OnInit {
  // Asignamos el icono a una variable pública para vincularlo en la vista
  planetIcon = planetOutline;

  usuario: any = null;

  private loginUrl = 'http://localhost/login.php';
  private cuentasUrl ='http://localhost/API_aplicacion1/usuarios.php';

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
    private alertController: AlertController
  ) {
    // Registrar explícitamente el icono con la clave exacta
    addIcons({ 'planet-outline': planetOutline, planetOutline });
  }

  ngOnInit() {
    this.cargarUsuario();
  }

  ionViewWillEnter() {
    this.cargarUsuario();
  }

  cargarUsuario() {
    const userData = localStorage.getItem('user');
    if (userData) {
      this.usuario = JSON.parse(userData);
    }
  }

  logout() {
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  nextStep() {
    if (this.currentStep === 1) {
      if (!this.registerData.email || !this.registerData.password) {
        this.showAlert('Atención', 'Ingresa correo y contraseña para continuar.');
        return;
      }
    }
    if (this.currentStep === 2) {
      if (!this.registerData.nombre) {
        this.showAlert('Atención', 'Por favor ingresa tu nombre completo.');
        return;
      }
    }
    if (this.currentStep < 3) {
      this.currentStep++;
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  async onLogin() {
    if (!this.loginData.email || !this.loginData.password) {
      await this.showAlert('Campos requeridos', 'Ingresa tu correo y contraseña.');
      return;
    }

    try {
      const response = await axios.post(this.loginUrl, this.loginData);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      this.cargarUsuario();
      await this.showAlert('¡Bienvenido!', response.data.message || 'Inicio de sesión exitoso.');
    } catch (error: any) {
      this.handleApiError(error);
    }
  }

  async onRegister() {
    try {
      const response = await axios.post(this.cuentasUrl, this.registerData, {
        headers: { 'Content-Type': 'application/json' }
      });
      await this.showAlert('Éxito', response.data.message || 'Cuenta creada correctamente.');
      
      this.mode = 'login';
      this.currentStep = 1;
      this.registerData = { email: '', password: '', nombre: '' };
    } catch (error: any) {
      this.handleApiError(error);
    }
  }

  private async handleApiError(error: any) {
    let errorMessage = 'Ocurrió un error inesperado al conectar con el servidor.';

    if (error.response && error.response.data && error.response.data.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    await this.showAlert('Error', errorMessage);
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}