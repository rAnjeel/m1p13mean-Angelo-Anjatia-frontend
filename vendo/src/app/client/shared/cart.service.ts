import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CartShopRef {
  _id?: string;
  name?: string;
}

export interface CartProductRef {
  _id: string;
  name?: string;
  price?: number;
  stock?: number;
  images?: Array<string | { url?: string; publicId?: string; alt?: string; isPrimary?: boolean; order?: number }>;
  isActive?: boolean;
}

export interface CartItem {
  _id: string;
  cartId: string;
  productId: string | CartProductRef;
  quantity: number;
}

export interface CartByShop {
  cartId: string;
  shopId: string;
  shopName: string;
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
}

interface ClientCartsResponse {
  carts: CartByShop[];
}

interface AddToCartPayload {
  productId: string;
  quantity: number;
}

interface CheckoutPayload {
  selectedProductIds: string[];
}

interface CheckoutResponse {
  message: string;
  order: {
    _id: string;
    status: string;
    totalAmount: number;
  };
}

interface UpdateQuantityPayload {
  quantity: number;
}

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/carts';

  getMyCarts(): Observable<ClientCartsResponse> {
    return this.http.get<ClientCartsResponse>(this.baseUrl);
  }

  addToCart(productId: string, quantity = 1): Observable<{ message: string }> {
    const payload: AddToCartPayload = {
      productId,
      quantity: Math.max(1, Number(quantity) || 1),
    };
    return this.http.post<{ message: string }>(`${this.baseUrl}/add`, payload);
  }

  checkout(shopId: string, selectedProductIds: string[] = []): Observable<CheckoutResponse> {
    const payload: CheckoutPayload = {
      selectedProductIds,
    };
    return this.http.post<CheckoutResponse>(`${this.baseUrl}/${shopId}/checkout`, payload);
  }

  updateItemQuantity(itemId: string, quantity: number): Observable<{ message: string }> {
    const payload: UpdateQuantityPayload = {
      quantity: Math.max(1, Number(quantity) || 1),
    };
    return this.http.patch<{ message: string }>(`${this.baseUrl}/items/${itemId}`, payload);
  }

  removeItem(itemId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/items/${itemId}`);
  }
}
