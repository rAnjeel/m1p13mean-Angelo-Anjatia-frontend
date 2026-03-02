import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type CategoryType = 'shop' | 'product';

export interface Category {
  _id: string;
  name: string;
  type: CategoryType;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryPayload {
  name: string;
  type: CategoryType;
}

interface CategoriesResponse {
  categories: Category[];
}

@Injectable({
  providedIn: 'root',
})
export class CategoriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/categories`;

  getCategories(): Observable<CategoriesResponse> {
    return this.http.get<CategoriesResponse>(this.baseUrl);
  }

  createCategory(payload: CategoryPayload): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  updateCategory(categoryId: string, payload: Partial<CategoryPayload>): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${categoryId}`, payload);
  }

  deleteCategory(categoryId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${categoryId}`);
  }
}



