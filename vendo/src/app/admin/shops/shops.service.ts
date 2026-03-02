import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ShopCategory {
  _id: string;
  name: string;
  type: 'shop' | 'product';
}

export interface ShopMerchant {
  _id: string;
  fullName: string;
  email: string;
}

export interface Shop {
  _id: string;
  name: string;
  description?: string;
  merchantId: string | ShopMerchant;
  categoryId: string | ShopCategory;
  location?: string;
  isOpen: boolean;
  images?: Array<{
    url: string;
    publicId: string;
    alt?: string;
    isPrimary?: boolean;
    order?: number;
  }>;
  createdAt: string;
}

export interface ShopPayload {
  name: string;
  description?: string;
  merchantId: string;
  categoryId: string;
  location?: string;
  isOpen: boolean;
}

export interface UserOption {
  _id: string;
  fullName: string;
  email: string;
  role: string;
}

interface ShopsResponse {
  shops: Shop[];
}

interface CategoriesResponse {
  categories: ShopCategory[];
}

interface UsersResponse {
  users: UserOption[];
}

interface ShopMutationResponse {
  message?: string;
  shop?: Shop;
}

@Injectable({
  providedIn: 'root',
})
export class ShopsService {
  private readonly http = inject(HttpClient);
  private readonly shopsBaseUrl = `${environment.apiUrl}/shops`;
  private readonly usersBaseUrl = `${environment.apiUrl}/users`;
  private readonly categoriesBaseUrl = `${environment.apiUrl}/categories`;

  getShops(): Observable<ShopsResponse> {
    return this.http.get<ShopsResponse>(this.shopsBaseUrl);
  }

  createShop(payload: ShopPayload): Observable<ShopMutationResponse> {
    return this.http.post<ShopMutationResponse>(this.shopsBaseUrl, payload);
  }

  updateShop(shopId: string, payload: Partial<ShopPayload>): Observable<ShopMutationResponse> {
    return this.http.put<ShopMutationResponse>(`${this.shopsBaseUrl}/${shopId}`, payload);
  }

  uploadShopImages(shopId: string, files: File[], replace = false): Observable<unknown> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file, file.name);
    });

    const query = replace ? '?replace=true' : '';
    return this.http.post(`${this.shopsBaseUrl}/${shopId}/images${query}`, formData);
  }

  deleteShop(shopId: string): Observable<unknown> {
    return this.http.delete(`${this.shopsBaseUrl}/${shopId}`);
  }

  getShopCategories(): Observable<CategoriesResponse> {
    return this.http.get<CategoriesResponse>(`${this.categoriesBaseUrl}/type/shop`);
  }

  getUsers(): Observable<UsersResponse> {
    return this.http.get<UsersResponse>(this.usersBaseUrl);
  }
}



