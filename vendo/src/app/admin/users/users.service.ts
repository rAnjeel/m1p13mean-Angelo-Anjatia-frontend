import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  _id: string;
  role: string;
  fullName: string;
  email: string;
  phone?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserCreatePayload {
  role: string;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  isActive?: boolean;
}

export interface UserUpdatePayload {
  role?: string;
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string;
  isActive?: boolean;
}

interface UsersResponse {
  users: User[];
}

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  getUsers(): Observable<UsersResponse> {
    return this.http.get<UsersResponse>(this.baseUrl);
  }

  createUser(payload: UserCreatePayload): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  updateUser(userId: string, payload: UserUpdatePayload): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${userId}`, payload);
  }

  deleteUser(userId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${userId}`);
  }
}



