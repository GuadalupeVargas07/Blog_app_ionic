import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';  

@Injectable({
  providedIn: 'root'
})

export class AuthService {
  // Cambia esta URL por la ruta real donde corre tu login.php
  private apiUrl = 'http://localhost/API_aplicacion1/login.php';

  constructor(private http: HttpClient) {}

login(credentials: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, credentials);
  }
}