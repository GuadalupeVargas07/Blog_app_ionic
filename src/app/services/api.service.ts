import { Injectable, inject } from '@angular/core';
import axios from 'axios';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly apiConfig = inject(ApiConfigService);

  private get baseUrl(): string {
    return this.apiConfig.getApiBaseUrl();
  }

  constructor() {}

  // ==========================================
  // 1. LOGIN (login.php)
  // ==========================================
  async login(credentials: { email: string; password: string }) {
    try {
      const response = await axios.post(`${this.baseUrl}/login.php`, credentials, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data;
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  }

  // ==========================================
  // 2. CUENTAS (cuentas.php)
  // ==========================================
  async getCuenta(userId: number) {
    try {
      const response = await axios.get(`${this.baseUrl}/cuentas.php?id=${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo cuenta:', error);
      throw error;
    }
  }

  async createCuenta(userData: { nombre: string; email: string; password: string }) {
    try {
      const response = await axios.post(`${this.baseUrl}/cuentas.php`, userData);
      return response.data;
    } catch (error) {
      console.error('Error creando cuenta:', error);
      throw error;
    }
  }

  async updateCuenta(userData: { id: number; nombre: string; email: string }) {
    try {
      const response = await axios.put(`${this.baseUrl}/cuentas.php`, userData);
      return response.data;
    } catch (error) {
      console.error('Error actualizando cuenta:', error);
      throw error;
    }
  }

  async deleteCuenta(userId: number) {
    try {
      const response = await axios.delete(`${this.baseUrl}/cuentas.php?id=${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error eliminando cuenta:', error);
      throw error;
    }
  }

  // ==========================================
  // 3. MOODS (moods.php)
  // ==========================================
  async getMoods(userId: number) {
    try {
      const response = await axios.get(`${this.baseUrl}/moods.php?user_id=${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo moods:', error);
      throw error;
    }
  }

  async addMood(moodData: { user_id: number; mood: string; comentario: string }) {
    try {
      const response = await axios.post(`${this.baseUrl}/moods.php`, moodData);
      return response.data;
    } catch (error) {
      console.error('Error registrando mood:', error);
      throw error;
    }
  }

  async deleteMood(moodId: number) {
    try {
      const response = await axios.delete(`${this.baseUrl}/moods.php?id=${moodId}`);
      return response.data;
    } catch (error) {
      console.error('Error eliminando mood:', error);
      throw error;
    }
  }

  // ==========================================
  // 4. DIARIO (diary.php)
  // ==========================================
  async getDiaryEntries(userId: number) {
    try {
      const response = await axios.get(`${this.baseUrl}/diary.php?user_id=${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo entradas de diario:', error);
      throw error;
    }
  }

  async addDiaryEntry(entryData: { user_id: number; titulo: string; contenido: string }) {
    try {
      const response = await axios.post(`${this.baseUrl}/diary.php`, entryData);
      return response.data;
    } catch (error) {
      console.error('Error guardando en diario:', error);
      throw error;
    }
  }

  async deleteDiaryEntry(entryId: number) {
    try {
      const response = await axios.delete(`${this.baseUrl}/diary.php?id=${entryId}`);
      return response.data;
    } catch (error) {
      console.error('Error eliminando entrada del diario:', error);
      throw error;
    }
  }

  // ==========================================
  // 5. UPLOAD (upload.php)
  // ==========================================
  async getUploads(userId: number) {
    try {
      const response = await axios.get(`${this.baseUrl}/upload.php?user_id=${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo uploads:', error);
      throw error;
    }
  }

  async uploadFile(uploadData: { user_id: number; file_name: string; image_base64: string }) {
    try {
      const response = await axios.post(`${this.baseUrl}/upload.php`, uploadData);
      return response.data;
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      throw error;
    }
  }

  async deleteFile(fileName: string, userId: number) {
    try {
      const response = await axios.delete(`${this.baseUrl}/upload.php?file_name=${fileName}&user_id=${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error eliminando archivo:', error);
      throw error;
    }
  }

  // ==========================================
  // 6. CAPTURES (captures.php)
  // ==========================================
  async getCaptures(userId: number) {
    try {
      const response = await axios.get(`${this.baseUrl}/captures.php?user_id=${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo capturas:', error);
      throw error;
    }
  }

  async addCapture(captureData: { user_id: number; file_name: string; descripcion?: string }) {
    try {
      const response = await axios.post(`${this.baseUrl}/captures.php`, captureData);
      return response.data;
    } catch (error) {
      console.error('Error guardando captura:', error);
      throw error;
    }
  }

  async deleteCapture(captureId: number) {
    try {
      const response = await axios.delete(`${this.baseUrl}/captures.php?id=${captureId}`);
      return response.data;
    } catch (error) {
      console.error('Error eliminando captura:', error);
      throw error;
    }
  }
}