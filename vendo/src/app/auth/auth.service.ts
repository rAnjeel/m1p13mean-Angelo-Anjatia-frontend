import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RegisterPayload {
  role: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  message?: string;
  user?: unknown;
  token?: string;
  accessToken?: string;
}

export interface ApiErrorResponse {
  message?: string;
  errors?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/auth';

  register(payload: RegisterPayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/register`, payload);
  }

  login(payload: LoginPayload): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, payload);
  }
}

