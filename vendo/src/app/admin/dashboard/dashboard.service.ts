import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ShopsByCategoryRow {
  categoryId: string;
  categoryName: string;
  categoryType?: string;
  totalShops: number;
}

export interface UsersByMonthRow {
  month: string;
  totalUsers: number;
}

interface TotalShopsResponse {
  totalShops: number;
}

interface TotalUsersResponse {
  totalUsers: number;
}

interface TotalRevenueResponse {
  totalRevenue: number;
}

interface ShopsByCategoryResponse {
  shopsByCategory: ShopsByCategoryRow[];
}

interface UsersByMonthResponse {
  totalUsersMonthly: UsersByMonthRow[];
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/dashboard';

  getTotalShops(): Observable<TotalShopsResponse> {
    return this.http.get<TotalShopsResponse>(`${this.baseUrl}/shops/total`);
  }

  getShopsByCategory(): Observable<ShopsByCategoryResponse> {
    return this.http.get<ShopsByCategoryResponse>(`${this.baseUrl}/shops/by-category`);
  }

  getTotalUsers(): Observable<TotalUsersResponse> {
    return this.http.get<TotalUsersResponse>(`${this.baseUrl}/users/total`);
  }

  getUsersMonthly(limit = 6): Observable<UsersByMonthResponse> {
    return this.http.get<UsersByMonthResponse>(`${this.baseUrl}/users/monthly?limit=${limit}`);
  }

  getTotalRevenue(): Observable<TotalRevenueResponse> {
    return this.http.get<TotalRevenueResponse>(`${this.baseUrl}/revenue/total`);
  }
}
