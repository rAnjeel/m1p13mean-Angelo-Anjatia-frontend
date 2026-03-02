import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ShopReviewClientRef {
  _id?: string;
  fullName?: string;
}

export interface ShopReview {
  _id: string;
  shopId: string;
  clientId: string | ShopReviewClientRef;
  rating: number;
  comment?: string;
  createdAt?: string;
}

interface ShopReviewsResponse {
  reviews: ShopReview[];
}

interface AddShopReviewPayload {
  rating: number;
  comment: string;
}

interface AddShopReviewResponse {
  message: string;
  review: ShopReview;
}

@Injectable({
  providedIn: 'root',
})
export class ShopReviewsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/shop-reviews`;

  getByShop(shopId: string): Observable<ShopReviewsResponse> {
    return this.http.get<ShopReviewsResponse>(`${this.baseUrl}/${shopId}`);
  }

  add(shopId: string, payload: AddShopReviewPayload): Observable<AddShopReviewResponse> {
    return this.http.post<AddShopReviewResponse>(`${this.baseUrl}/${shopId}`, payload);
  }
}

