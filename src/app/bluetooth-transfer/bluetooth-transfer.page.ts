import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { bluetoothOutline, closeCircleOutline, cloudUploadOutline, trashOutline } from 'ionicons/icons';
import {
  BleBufferedFile,
  BleIncomingRequest,
  BluetoothTransferService,
} from '../services/bluetooth-transfer.service';

@Component({
  selector: 'app-bluetooth-transfer',
  templateUrl: './bluetooth-transfer.page.html',
  styleUrl: './bluetooth-transfer.page.scss',
  imports: [
    CommonModule,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
})
export class BluetoothTransferPage implements OnInit {
  readonly transfer = inject(BluetoothTransferService);
  readonly busy = signal(false);
  selectedFile: File | null = null;
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  constructor() {
    addIcons({ bluetoothOutline, closeCircleOutline, cloudUploadOutline, trashOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.loadFiles();
  }

  ionViewWillLeave(): void {
    void this.stopReceiving();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    input.value = '';
  }

  async startReceiving(): Promise<void> {
    this.busy.set(true);
    try {
      await this.transfer.startReceiving({
        onIncomingRequest: (request) => { void this.confirmIncomingFile(request); },
        onReceived: (file) => { void this.showReceived(file); },
        onError: (message) => { void this.showToast(message, 'danger'); },
      });
      await this.showToast('Recepción activada. Mantén esta pantalla abierta.', 'success');
    } catch (error) {
      await this.showToast(errorMessage(error), 'danger');
    } finally {
      this.busy.set(false);
    }
  }

  async stopReceiving(): Promise<void> {
    if (!this.transfer.receiving()) {
      return;
    }
    try {
      await this.transfer.stopReceiving();
    } catch (error) {
      await this.showToast(errorMessage(error), 'danger');
    }
  }

  async sendFile(): Promise<void> {
    if (!this.selectedFile) {
      await this.showToast('Selecciona primero un archivo.', 'warning');
      return;
    }

    this.busy.set(true);
    try {
      await this.transfer.sendFile(this.selectedFile);
      await this.showToast('El archivo se transfirió al buffer local del receptor.', 'success');
      this.selectedFile = null;
    } catch (error) {
      await this.showToast(errorMessage(error), 'danger');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteFile(file: BleBufferedFile): Promise<void> {
    try {
      await this.transfer.deleteBufferedFile(file.id);
      await this.showToast('Archivo eliminado del buffer local.', 'medium');
    } catch (error) {
      await this.showToast(errorMessage(error), 'danger');
    }
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private async loadFiles(): Promise<void> {
    try {
      await this.transfer.refreshBufferedFiles();
    } catch (error) {
      await this.showToast(errorMessage(error), 'danger');
    }
  }

  private async confirmIncomingFile(request: BleIncomingRequest): Promise<void> {
    let accepted = false;
    try {
      const alert = await this.alerts.create({
        header: 'Archivo entrante',
        message: `¿Aceptas recibir «${request.name}» (${this.formatSize(request.size)})?`,
        buttons: [
          { text: 'Rechazar', role: 'cancel' },
          { text: 'Aceptar', role: 'accept' },
        ],
      });
      await alert.present();
      const result = await alert.onDidDismiss();
      accepted = result.role === 'accept';
      await this.transfer.respondToRequest(request.requestId, accepted);
    } catch (error) {
      await this.showToast(errorMessage(error), 'danger');
    }
  }

  private async showReceived(file: BleBufferedFile): Promise<void> {
    await this.loadFiles();
    await this.showToast(`${file.name} se guardó en el buffer local.`, 'success');
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 3500, position: 'bottom' });
    await toast.present();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error durante la transferencia Bluetooth.';
}
