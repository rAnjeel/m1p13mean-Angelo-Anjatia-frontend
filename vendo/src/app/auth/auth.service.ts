import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

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
  private readonly tokenStorageKey = 'auth_token';
  private readonly userStorageKey = 'auth_user';

  register(payload: RegisterPayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/register`, payload);
  }

  login(payload: LoginPayload): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, payload);
  }

  logout(): Observable<unknown> {
    const token = this.getToken();
    if (!token) {
      return of({ message: 'No active session.' });
    }

    return this.http.post(`${this.baseUrl}/logout`, {});
  }

  getToken(): string | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }

    const token = localStorage.getItem(this.tokenStorageKey);
    return token?.trim() || null;
  }

  setSession(token: string, user: unknown): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.tokenStorageKey, token);
    localStorage.setItem(this.userStorageKey, JSON.stringify(user));
  }

  clearSession(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.userStorageKey);
  }
}

