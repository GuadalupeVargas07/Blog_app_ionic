import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { ApiConfigService, ApiServerConfig } from '../services/api-config.service';

@Component({
  selector: 'app-data-source',
  templateUrl: './data-source.page.html',
  styleUrls: ['./data-source.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
  ],
})
export class DataSourcePage implements OnInit {
  protocol: ApiServerConfig['protocol'] = 'http';
  host = '';
  port = '80';
  message = '';
  saved = false;

  constructor(
    private readonly apiConfig: ApiConfigService,
    private readonly location: Location,
  ) {}

  ngOnInit(): void {
    const config = this.apiConfig.getServerConfig();
    if (config) {
      this.protocol = config.protocol;
      this.host = config.host;
      this.port = config.port;
    }
  }

  guardar(): void {
    try {
      this.apiConfig.saveServerConfig({
        protocol: this.protocol,
        host: this.host,
        port: this.port,
      });
      this.host = this.apiConfig.getServerConfig()?.host ?? this.host;
      this.port = this.apiConfig.getServerConfig()?.port ?? this.port;
      this.message = 'Origen de datos guardado en este dispositivo.';
      this.saved = true;
    } catch (error: unknown) {
      this.message = error instanceof Error ? error.message : 'No se pudo guardar la dirección.';
      this.saved = false;
    }
  }

  volver(): void {
    this.location.back();
  }
}