import { Injectable } from '@angular/core';
import axios from 'axios';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private readonly apiConfig: ApiConfigService) {}

  private get baseUrl(): string {
    return this.apiConfig.getApiBaseUrl();
  }

  async login(credentials: { email: string; password: string }): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/login.php`, credentials, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  }

  async register(userData: { email: string; password: string; nombre: string }): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/cuentas.php?action=register`, userData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  }

  async getProfile(userId: number): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/cuentas.php?action=get_profile&id=${userId}`);
    return response.data;
  }
}