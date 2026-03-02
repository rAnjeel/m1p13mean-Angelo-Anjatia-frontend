import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FavoriteShopRef {
  _id?: string;
  name?: string;
}

export interface Favorite {
  _id: string;
  clientId: string;
  shopId: string | FavoriteShopRef;
  createdAt?: string;
}

interface FavoritesResponse {
  favorites: Favorite[];
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/favorites`;

  getFavorites(): Observable<FavoritesResponse> {
    return this.http.get<FavoritesResponse>(this.baseUrl);
  }

  addFavorite(shopId: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${shopId}`, {});
  }

  removeFavorite(shopId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${shopId}`);
  }

  extractShopIds(favorites: Favorite[]): string[] {
    return (favorites || [])
      .map((favorite) => {
        const shop = favorite?.shopId;
        if (typeof shop === 'string') return shop;
        return shop?._id || '';
      })
      .filter((id) => !!id);
  }
}




