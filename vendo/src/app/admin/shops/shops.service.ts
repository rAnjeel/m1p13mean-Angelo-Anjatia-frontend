import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

export interface ShopImage {
  url: string;
  publicId: string;
  alt: string;
  isPrimary: boolean;
  order: number;
}

export interface Shop {
  _id: string;
  name: string;
  description?: string;
  merchantId: string | ShopMerchant;
  categoryId: string | ShopCategory;
  location?: string;
  isOpen: boolean;
  createdAt: string;
  images?: ShopImage[];
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

@Injectable({
  providedIn: 'root',
})
export class ShopsService {
  private readonly http = inject(HttpClient);
  private readonly shopsBaseUrl = 'http://localhost:3000/api/shops';
  private readonly usersBaseUrl = 'http://localhost:3000/api/users';
  private readonly categoriesBaseUrl = 'http://localhost:3000/api/categories';

  getShops(): Observable<ShopsResponse> {
    return this.http.get<ShopsResponse>(this.shopsBaseUrl);
  }

  createShop(payload: ShopPayload): Observable<unknown> {
    return this.http.post(this.shopsBaseUrl, payload);
  }

  updateShop(shopId: string, payload: Partial<ShopPayload>): Observable<unknown> {
    return this.http.put(`${this.shopsBaseUrl}/${shopId}`, payload);
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

  addShopImages(shopId: string, files: File[], replace = false): Observable<Shop> {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    const replaceQuery = replace ? '?replace=true' : '';
    return this.http.post<Shop>(`${this.shopsBaseUrl}/${shopId}/images${replaceQuery}`, formData);
  }

  removeShopImage(shopId: string, publicId: string): Observable<Shop> {
    const encodedId = encodeURIComponent(publicId);
    return this.http.delete<Shop>(`${this.shopsBaseUrl}/${shopId}/images/${encodedId}`);
  }
}
