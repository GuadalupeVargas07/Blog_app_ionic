import { Injectable, inject } from '@angular/core';
import axios from 'axios';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiConfig = inject(ApiConfigService);

  async login(credentials: { email: string; password: string }): Promise<any> {
    const formData = new URLSearchParams({
      email: credentials.email,
      password: credentials.password,
    });
    const response = await axios.post(`${this.apiConfig.getApiBaseUrl()}/login.php`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    });

    return response.data;
  }

  async register(userData: { email: string; password: string; nombre: string }): Promise<any> {
    const response = await axios.post(`${this.apiConfig.getApiBaseUrl()}/cuentas.php?action=register`, userData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  }

  async getProfile(userId: number): Promise<any> {
    const response = await axios.get(`${this.apiConfig.getApiBaseUrl()}/cuentas.php?action=get_profile&id=${userId}`);
    return response.data;
  }
}