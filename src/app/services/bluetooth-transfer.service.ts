import { Injectable, signal } from '@angular/core';
import { Capacitor, PluginListenerHandle, registerPlugin } from '@capacitor/core';
import {
  BleClient,
  ConnectionPriority,
} from '@capacitor-community/bluetooth-le';

const SERVICE_UUID = '799b0001-6d8c-4a8f-9f44-3e63945e2a10';
const CONTROL_UUID = '799b0002-6d8c-4a8f-9f44-3e63945e2a10';
const DATA_UUID = '799b0003-6d8c-4a8f-9f44-3e63945e2a10';
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface BleIncomingRequest {
  requestId: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface BleBufferedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  path: string;
  receivedAt: number;
}

interface BlePeripheralPlugin {
  startReceiving(): Promise<void>;
  stopReceiving(): Promise<void>;
  respondToOffer(options: { requestId: string; accepted: boolean }): Promise<void>;
  getBufferedFiles(): Promise<{ files: BleBufferedFile[] }>;
  deleteBufferedFile(options: { id: string }): Promise<void>;
  addListener(
    eventName: 'incomingRequest',
    listener: (event: BleIncomingRequest) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'fileReceived',
    listener: (event: BleBufferedFile) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'receiveProgress',
    listener: (event: { received: number; total: number }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'transferError',
    listener: (event: { message: string }) => void,
  ): Promise<PluginListenerHandle>;
}

interface ReceiverHandlers {
  onIncomingRequest: (request: BleIncomingRequest) => void;
  onReceived: (file: BleBufferedFile) => void;
  onError: (message: string) => void;
}

interface StatusWaiter {
  statuses: number[];
  resolve: (status: number) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

const peripheral = registerPlugin<BlePeripheralPlugin>('BlePeripheral');

@Injectable({ providedIn: 'root' })
export class BluetoothTransferService {
  readonly receiving = signal(false);
  readonly files = signal<BleBufferedFile[]>([]);
  readonly progress = signal<number | null>(null);

  private receiverHandlers: ReceiverHandlers | null = null;
  private receiverListeners: PluginListenerHandle[] = [];
  private readonly statusQueue: number[] = [];
  private readonly statusWaiters: StatusWaiter[] = [];

  async startReceiving(handlers: ReceiverHandlers): Promise<void> {
    this.assertAndroid();
    if (this.receiving()) {
      return;
    }

    this.receiverHandlers = handlers;
    this.receiverListeners = await Promise.all([
      peripheral.addListener('incomingRequest', (request) => {
        this.receiverHandlers?.onIncomingRequest(request);
      }),
      peripheral.addListener('fileReceived', (file) => {
        this.files.update((current) => [file, ...current.filter((item) => item.id !== file.id)]);
        this.progress.set(null);
        this.receiverHandlers?.onReceived(file);
      }),
      peripheral.addListener('receiveProgress', ({ received, total }) => {
        this.progress.set(total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0);
      }),
      peripheral.addListener('transferError', ({ message }) => {
        this.progress.set(null);
        this.receiverHandlers?.onError(message);
      }),
    ]);

    try {
      await peripheral.startReceiving();
      this.receiving.set(true);
      await this.refreshBufferedFiles();
    } catch (error) {
      await this.removeReceiverListeners();
      this.receiverHandlers = null;
      throw error;
    }
  }

  async stopReceiving(): Promise<void> {
    if (!this.receiving()) {
      return;
    }
    try {
      await peripheral.stopReceiving();
    } finally {
      this.receiving.set(false);
      this.progress.set(null);
      this.receiverHandlers = null;
      await this.removeReceiverListeners();
    }
  }

  async respondToRequest(requestId: string, accepted: boolean): Promise<void> {
    await peripheral.respondToOffer({ requestId, accepted });
  }

  async refreshBufferedFiles(): Promise<void> {
    this.assertAndroid();
    const result = await peripheral.getBufferedFiles();
    this.files.set(result.files);
  }

  async deleteBufferedFile(id: string): Promise<void> {
    await peripheral.deleteBufferedFile({ id });
    this.files.update((current) => current.filter((file) => file.id !== id));
  }

  async sendFile(file: File): Promise<void> {
    this.assertAndroid();
    if (file.size < 1 || file.size > MAX_FILE_BYTES) {
      throw new Error('El archivo debe tener entre 1 byte y 20 MB para enviarse por BLE.');
    }

    let deviceId: string | null = null;
    let notificationsStarted = false;
    this.progress.set(0);
    this.statusQueue.length = 0;
    try {
      await BleClient.initialize();
      const device = await BleClient.requestDevice({ services: [SERVICE_UUID] });
      deviceId = device.deviceId;
      await BleClient.connect(deviceId);
      await BleClient.requestConnectionPriority(deviceId, ConnectionPriority.CONNECTION_PRIORITY_HIGH);
      await BleClient.startNotifications(deviceId, SERVICE_UUID, CONTROL_UUID, (value) => {
        if (value.byteLength > 0) {
          this.receiveStatus(value.getUint8(0));
        }
      });
      notificationsStarted = true;

      const mtu = await BleClient.getMtu(deviceId);
      const payloadSize = Math.max(20, mtu - 3);
      await this.writeOffer(deviceId, file, payloadSize);
      const decision = this.waitForStatus([2, 3], 120_000);
      if (await decision === 3) {
        throw new Error('El receptor rechazó el archivo.');
      }

      const contents = new Uint8Array(await file.arrayBuffer());
      for (let offset = 0; offset < contents.length; offset += payloadSize) {
        const chunk = contents.subarray(offset, Math.min(offset + payloadSize, contents.length));
        await BleClient.write(deviceId, SERVICE_UUID, DATA_UUID, toDataView(chunk));
        this.progress.set(Math.round(((offset + chunk.length) / contents.length) * 100));
      }
      await this.waitForStatus([4], 120_000);
    } finally {
      if (deviceId && notificationsStarted) {
        try {
          await BleClient.stopNotifications(deviceId, SERVICE_UUID, CONTROL_UUID);
        } catch (error) {
          console.warn('No se pudieron detener las notificaciones BLE.', error);
        }
      }
      if (deviceId) {
        try {
          await BleClient.disconnect(deviceId);
        } catch (error) {
          console.warn('No se pudo cerrar la conexión BLE.', error);
        }
      }
      this.clearStatusWaiters();
      this.progress.set(null);
    }
  }

  private async writeOffer(deviceId: string, file: File, payloadSize: number): Promise<void> {
    const metadata = new TextEncoder().encode(JSON.stringify({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    }));
    const framePayloadSize = payloadSize - 3;
    const frameCount = Math.ceil(metadata.length / framePayloadSize);
    if (frameCount > 250) {
      throw new Error('Los datos del archivo exceden el tamaño permitido para BLE.');
    }

    for (let sequence = 0; sequence < frameCount; sequence++) {
      const start = sequence * framePayloadSize;
      const payload = metadata.subarray(start, Math.min(start + framePayloadSize, metadata.length));
      const frame = new Uint8Array(payload.length + 3);
      frame[0] = 1;
      frame[1] = sequence;
      frame[2] = frameCount;
      frame.set(payload, 3);
      await BleClient.write(deviceId, SERVICE_UUID, CONTROL_UUID, toDataView(frame));
    }
  }

  private waitForStatus(statuses: number[], timeoutMs: number): Promise<number> {
    const queuedIndex = this.statusQueue.findIndex((status) => statuses.includes(status));
    if (queuedIndex >= 0) {
      return Promise.resolve(this.statusQueue.splice(queuedIndex, 1)[0]);
    }

    return new Promise<number>((resolve, reject) => {
      const waiter: StatusWaiter = {
        statuses,
        resolve,
        reject,
        timeoutId: setTimeout(() => {
          this.removeStatusWaiter(waiter);
          reject(new Error('Se agotó el tiempo de espera de la transferencia Bluetooth.'));
        }, timeoutMs),
      };
      this.statusWaiters.push(waiter);
    });
  }

  private receiveStatus(status: number): void {
    const waiterIndex = this.statusWaiters.findIndex((waiter) => waiter.statuses.includes(status));
    if (waiterIndex < 0) {
      this.statusQueue.push(status);
      return;
    }
    const [waiter] = this.statusWaiters.splice(waiterIndex, 1);
    clearTimeout(waiter.timeoutId);
    waiter.resolve(status);
  }

  private removeStatusWaiter(waiter: StatusWaiter): void {
    const index = this.statusWaiters.indexOf(waiter);
    if (index >= 0) {
      this.statusWaiters.splice(index, 1);
    }
  }

  private clearStatusWaiters(): void {
    for (const waiter of this.statusWaiters.splice(0)) {
      clearTimeout(waiter.timeoutId);
      waiter.reject(new Error('La conexión Bluetooth se cerró antes de finalizar.'));
    }
    this.statusQueue.length = 0;
  }

  private async removeReceiverListeners(): Promise<void> {
    await Promise.all(this.receiverListeners.map((listener) => listener.remove()));
    this.receiverListeners = [];
  }

  private assertAndroid(): void {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      throw new Error('La recepción y el envío BLE están disponibles en la app Android.');
    }
  }
}

function toDataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
