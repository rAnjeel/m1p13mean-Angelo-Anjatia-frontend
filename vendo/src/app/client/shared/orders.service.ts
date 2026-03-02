import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  shopId?: string;
  shopName?: string;
  quantity: number;
  priceAtPurchase: number;
}

export interface ClientOrderWithItems extends PaidOrder {
  items: PaidOrderItem[];
}

interface PayOrderResponse {
  message: string;
  order: PaidOrder;
  items: PaidOrderItem[];
}

interface ClientOrdersResponse {
  orders: ClientOrderWithItems[];
}

@Injectable({
  providedIn: 'root',
})
export class ClientOrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/orders`;

  payOrder(orderId: string, payload: PayOrderPayload): Observable<PayOrderResponse> {
    return this.http.put<PayOrderResponse>(`${this.baseUrl}/${orderId}/pay`, payload);
  }

  getMyOrders(): Observable<ClientOrdersResponse> {
    return this.http.get<ClientOrdersResponse>(`${this.baseUrl}/my`);
  }
}




