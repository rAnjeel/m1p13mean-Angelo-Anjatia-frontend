import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PayOrderPayload {
  paymentMethod: 'bank_card' | 'visa';
  cardNumber: string;
  cardHolderName: string;
  pickupDate: string;
}

export interface PaidOrder {
  _id: string;
  clientId: string;
  status: string;
  totalAmount: number;
  paymentMethod?: 'bank_card' | 'visa';
  cardLast4?: string;
  cardHolderName?: string;
  pickupDate?: string;
  paidAt?: string;
  createdAt?: string;
}

export interface PaidOrderItem {
  _id: string;
  orderId: string;
  productId: string;
  productName?: string;
  quantity: number;
  priceAtPurchase: number;
}

interface PayOrderResponse {
  message: string;
  order: PaidOrder;
  items: PaidOrderItem[];
}

@Injectable({
  providedIn: 'root',
})
export class ClientOrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/orders';

  payOrder(orderId: string, payload: PayOrderPayload): Observable<PayOrderResponse> {
    return this.http.put<PayOrderResponse>(`${this.baseUrl}/${orderId}/pay`, payload);
  }
}

