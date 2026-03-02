import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ShopkeeperFinancialOrderItem {
  productId?: string;
  productName: string;
  quantity: number;
  priceAtPurchase: number;
  lineTotal: number;
  shopName?: string;
}

export interface ShopkeeperFinancialOrder {
  orderId: string;
  createdAt?: string;
  status: string;
  clientName?: string;
  totalAmount: number;
  itemCount: number;
  shops: string[];
  items: ShopkeeperFinancialOrderItem[];
}

export interface ShopkeeperTopProduct {
  productId?: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface ShopkeeperFinancialSummary {
  shops: Array<{ _id: string; name: string }>;
  totalSales: number;
  orders: ShopkeeperFinancialOrder[];
  topProducts: ShopkeeperTopProduct[];
}

@Injectable({
  providedIn: 'root',
})
export class ShopkeeperFinanceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/orders';

  getFinancialSummary(): Observable<ShopkeeperFinancialSummary> {
    return this.http.get<ShopkeeperFinancialSummary>(`${this.baseUrl}/shopkeeper/financial`);
  }
}
