import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RentShop {
  _id: string;
  name: string;
  location?: string;
  merchantId?: string;
}

export interface Rent {
  _id: string;
  shopId: string | RentShop;
  month: string;
  amount: number;
  status: 'unpaid' | 'paid';
  paidAt?: string;
  createdAt?: string;
}

export interface UnpaidRentsResponse {
  month: string;
  totalUnpaid: number;
  rents: Rent[];
  message?: string;
}

export interface PaidRentsResponse {
  totalPaid: number;
  rents: Rent[];
}

@Injectable({
  providedIn: 'root',
})
export class RentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/rents';

  getUnpaidRents(month: number, year: number): Observable<UnpaidRentsResponse> {
    return this.http.get<UnpaidRentsResponse>(`${this.baseUrl}/unpaid?month=${month}&year=${year}`);
  }

  getPaidRents(limit = 100): Observable<PaidRentsResponse> {
    return this.http.get<PaidRentsResponse>(`${this.baseUrl}/paid?limit=${limit}`);
  }

  payRent(rentId: string): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${rentId}/pay`, {});
  }
}
