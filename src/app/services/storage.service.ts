import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  constructor() { }

  // Guardar un dato (clave-valor)
  async set(key: string, value: any): Promise<void> {
    await Preferences.set({
      key: key,
      value: JSON.stringify(value), // Convertimos a string para soportar objetos y arrays
    });
  }

  // Obtener un dato por su clave
  async get(key: string): Promise<any> {
    const { value } = await Preferences.get({ key: key });
    return value ? JSON.parse(value) : null;
  }

  // Eliminar un dato específico
  async remove(key: string): Promise<void> {
    await Preferences.remove({ key: key });
  }

  // Limpiar todo el almacenamiento
  async clear(): Promise<void> {
    await Preferences.clear();
  }
}
