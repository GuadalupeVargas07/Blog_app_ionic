import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonApp,
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonModal,
  IonRouterOutlet,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { pulseOutline } from 'ionicons/icons';
import { ApiDiagnosticsService } from './services/api-diagnostics.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [
    CommonModule,
    IonApp,
    IonButton,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonModal,
    IonRouterOutlet,
    IonTitle,
    IonToolbar,
  ],
})
export class AppComponent {
  readonly diagnostics = inject(ApiDiagnosticsService);

  constructor() {
    addIcons({ 'pulse-outline': pulseOutline });
  }
}
