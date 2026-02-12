import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProductCategory {
  _id: string;
  name: string;
  type: 'shop' | 'product';
}

export interface ShopMerchantRef {
  _id: string;
  fullName: string;
  email: string;
}

export interface ShopOption {
  _id: string;
  name: string;
  merchantId: string | ShopMerchantRef;
}

export interface ProductShopRef {
  _id: string;
  name: string;
  merchantId?: string;
}

export interface Product {
  _id: string;
  shopId: string | ProductShopRef;
  categoryId: string | ProductCategory;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images?: string[];
  isActive: boolean;
  createdAt: string;
}

export interface ProductPayload {
  shopId: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images?: string[];
  isActive: boolean;
}

interface ProductsResponse {
  products: Product[];
}

interface CategoriesResponse {
  categories: ProductCategory[];
}

interface ShopsResponse {
  shops: ShopOption[];
}

@Injectable({
  providedIn: 'root',
})
export class ShopkeeperProductsService {
  private readonly http = inject(HttpClient);
  private readonly productsBaseUrl = 'http://localhost:3000/api/products';
  private readonly categoriesBaseUrl = 'http://localhost:3000/api/categories';
  private readonly shopsBaseUrl = 'http://localhost:3000/api/shops';

  getProducts(): Observable<ProductsResponse> {
    return this.http.get<ProductsResponse>(this.productsBaseUrl);
  }

  createProduct(payload: ProductPayload): Observable<unknown> {
    return this.http.post(this.productsBaseUrl, payload);
  }

  updateProduct(productId: string, payload: Partial<ProductPayload>): Observable<unknown> {
    return this.http.put(`${this.productsBaseUrl}/${productId}`, payload);
  }

  deleteProduct(productId: string): Observable<unknown> {
    return this.http.delete(`${this.productsBaseUrl}/${productId}`);
  }

  getProductCategories(): Observable<CategoriesResponse> {
    return this.http.get<CategoriesResponse>(`${this.categoriesBaseUrl}/type/product`);
  }

  getShops(): Observable<ShopsResponse> {
    return this.http.get<ShopsResponse>(this.shopsBaseUrl);
  }
}
