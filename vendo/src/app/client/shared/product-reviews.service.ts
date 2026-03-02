import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReviewClientRef {
  _id?: string;
  fullName?: string;
}

export interface ProductReview {
  _id: string;
  productId: string;
  clientId: string | ReviewClientRef;
  rating: number;
  comment?: string;
  createdAt?: string;
}

interface ProductReviewsResponse {
  reviews: ProductReview[];
}

interface AddProductReviewPayload {
  rating: number;
  comment: string;
}

interface AddProductReviewResponse {
  message: string;
  review: ProductReview;
}

@Injectable({
  providedIn: 'root',
})
export class ProductReviewsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reviews`;

  getByProduct(productId: string): Observable<ProductReviewsResponse> {
    return this.http.get<ProductReviewsResponse>(`${this.baseUrl}/${productId}`);
  }

  add(productId: string, payload: AddProductReviewPayload): Observable<AddProductReviewResponse> {
    return this.http.post<AddProductReviewResponse>(`${this.baseUrl}/${productId}`, payload);
  }
}



