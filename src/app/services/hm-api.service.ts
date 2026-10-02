import { Injectable, inject } from '@angular/core';
import axios from 'axios';
import { ApiConfigService } from './api-config.service';
import { ApiCacheService } from './api-cache.service';

export interface DiaryEntry {
  id: number;
  user_id: number;
  title: string;
  excerpt: string;
  readTime: string;
  date: string;
}

export interface SharedCapture {
  id: number;
  user_id: number;
  imageUrl: string;
  caption: string;
  location: string;
  date: string;
}

export interface MoodEntry {
  id: number;
  user_id: number;
  name: string;
  vibe: string;
  energy: number;
  music: string;
  date: string;
}

@Injectable({
  providedIn: 'root',
})
export class HmApiService {
  private readonly apiConfig = inject(ApiConfigService);
  private readonly apiCache = inject(ApiCacheService);

  private get baseUrl(): string {
    return this.apiConfig.getApiBaseUrl();
  }

  // ===================== DIARIO (diary.php) =====================
  async getDiary(userId: number): Promise<DiaryEntry[]> {
    return this.apiCache.load('diary', userId, async () => {
      const { data } = await axios.get(`${this.baseUrl}/diary.php`, { params: { user_id: userId } });
      return (data?.data ?? []).map((entry: any) => ({ ...entry, id: Number(entry.id), user_id: Number(entry.user_id) }));
    });
  }

  async addDiary(payload: { user_id: number; title: string; excerpt: string; readTime: string }): Promise<any> {
    const { data } = await axios.post(`${this.baseUrl}/diary.php`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    await this.apiCache.invalidateUser(payload.user_id);
    return data;
  }

  async updateDiary(payload: { id: number; user_id: number; title: string; excerpt: string; readTime: string }): Promise<any> {
    const { data } = await axios.put(`${this.baseUrl}/diary.php`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    await this.apiCache.invalidateUser(payload.user_id);
    return data;
  }

  // ===================== CAPTURAS (captures.php) =====================
  async getCaptures(userId: number): Promise<SharedCapture[]> {
    return this.apiCache.load('captures', userId, async () => {
      const { data } = await axios.get(`${this.baseUrl}/captures.php`, { params: { user_id: userId } });
      return (data?.data ?? []).map((capture: any) => ({
        ...capture,
        id: Number(capture.id),
        user_id: Number(capture.user_id),
        imageUrl: this.apiConfig.resolveAssetUrl(capture.imageUrl ?? capture.image_url) ?? '',
      }));
    });
  }

  /**
   * Sube la imagen como multipart/form-data. captures.php guarda el archivo
   * en /API_aplicacion1/uploads y en la base solo inserta el link (image_url).
   */
  async addCapture(payload: { user_id: number; image: File; caption?: string; location?: string }): Promise<any> {
    const form = new FormData();
    form.append('user_id', String(payload.user_id));
    form.append('image', payload.image, payload.image.name); // el campo DEBE llamarse "image"
    form.append('caption', payload.caption ?? '');
    form.append('location', payload.location ?? '');

    // Sin Content-Type manual: axios/navegador agregan el boundary solos
    const { data } = await axios.post(`${this.baseUrl}/captures.php`, form);
    await this.apiCache.invalidateUser(payload.user_id);
    return data;
  }

  async updateCapture(payload: { id: number; user_id: number; image?: File; caption?: string; location?: string }): Promise<any> {
    const form = new FormData();
    form.append('id', String(payload.id));
    form.append('user_id', String(payload.user_id));
    if (payload.image) {
      form.append('image', payload.image, payload.image.name);
    }
    form.append('caption', payload.caption ?? '');
    form.append('location', payload.location ?? '');

    const { data } = await axios.put(`${this.baseUrl}/captures.php`, form);
    await this.apiCache.invalidateUser(payload.user_id);
    return data;
  }

  // ===================== ÁNIMO (moods.php) =====================
  async getMoods(userId: number): Promise<MoodEntry[]> {
    return this.apiCache.load('moods', userId, async () => {
      const { data } = await axios.get(`${this.baseUrl}/moods.php`, { params: { user_id: userId } });
      return (data?.data ?? []).map((mood: any) => ({
        ...mood,
        id: Number(mood.id),
        user_id: Number(mood.user_id),
        energy: Number(mood.energy),
      }));
    });
  }

  async addMood(payload: { user_id: number; name: string; vibe: string; energy: number; music: string }): Promise<any> {
    const { data } = await axios.post(`${this.baseUrl}/moods.php`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    await this.apiCache.invalidateUser(payload.user_id);
    return data;
  }

  async updateMood(payload: { id: number; user_id: number; name: string; vibe: string; energy: number; music: string }): Promise<any> {
    const { data } = await axios.put(`${this.baseUrl}/moods.php`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    await this.apiCache.invalidateUser(payload.user_id);
    return data;
  }

  async deleteDiary(userId: number, diaryId: number): Promise<any> {
    const { data } = await axios.delete(`${this.baseUrl}/diary.php`, {
      params: { user_id: userId, id: diaryId },
    });
    await this.apiCache.invalidateUser(userId);
    return data;
  }

  async deleteCapture(userId: number, captureId: number): Promise<any> {
    const { data } = await axios.delete(`${this.baseUrl}/captures.php`, {
      params: { user_id: userId, id: captureId },
    });
    await this.apiCache.invalidateUser(userId);
    return data;
  }

  async deleteMood(userId: number, moodId: number): Promise<any> {
    const { data } = await axios.delete(`${this.baseUrl}/moods.php`, {
      params: { user_id: userId, id: moodId },
    });
    await this.apiCache.invalidateUser(userId);
    return data;
  }
}