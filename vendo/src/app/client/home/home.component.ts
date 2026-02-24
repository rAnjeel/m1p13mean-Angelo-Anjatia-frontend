import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import {
  CLIENT_CATEGORIES,
  CLIENT_DEALS,
  CLIENT_PRODUCTS,
  CLIENT_SERVICES,
  CLIENT_SHOPS,
} from './data/home.data';
import { ClientCategory, ClientProduct, ClientShop } from './models/home.models';

@Component({
  selector: 'app-client-home',
  standalone: true,
  imports: [NgFor, NgClass, NgIf],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class ClientHomeComponent implements OnInit, OnDestroy {
  readonly categories = CLIENT_CATEGORIES;
  readonly deals = CLIENT_DEALS;
  readonly services = CLIENT_SERVICES;
  readonly stars = Array.from({ length: 5 });

  selectedCategory = 'all';
  cartCount = 0;
  favoriteProductIds = new Set<number>();
  timerDays = '00';
  timerHours = '00';
  timerMinutes = '00';
  timerSeconds = '00';

  private readonly countdownTarget = new Date(Date.now() + (3 * 86400 + 14 * 3600 + 27 * 60) * 1000);
  private timerId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.updateTimer();
    this.timerId = setInterval(() => this.updateTimer(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  get filteredShops(): ClientShop[] {
    if (this.selectedCategory === 'all') {
      return CLIENT_SHOPS;
    }

    return CLIENT_SHOPS.filter((shop) => shop.category === this.selectedCategory);
  }

  get filteredProducts(): ClientProduct[] {
    if (this.selectedCategory === 'all') {
      return CLIENT_PRODUCTS;
    }

    return CLIENT_PRODUCTS.filter((product) => product.category === this.selectedCategory);
  }

  setCategory(category: ClientCategory): void {
    this.selectedCategory = category.key;
  }

  addToCart(): void {
    this.cartCount += 1;
  }

  toggleFavorite(productId: number): void {
    if (this.favoriteProductIds.has(productId)) {
      this.favoriteProductIds.delete(productId);
      return;
    }

    this.favoriteProductIds.add(productId);
  }

  isFavorite(productId: number): boolean {
    return this.favoriteProductIds.has(productId);
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  private updateTimer(): void {
    const diff = Math.max(0, this.countdownTarget.getTime() - Date.now());
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    this.timerDays = String(days).padStart(2, '0');
    this.timerHours = String(hours).padStart(2, '0');
    this.timerMinutes = String(minutes).padStart(2, '0');
    this.timerSeconds = String(seconds).padStart(2, '0');
  }
}
