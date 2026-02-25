import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NgClass, NgFor, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import {
  CLIENT_CATEGORIES,
  CLIENT_DEALS,
  CLIENT_SERVICES,
  CLIENT_SHOPS,
} from './data/home.data';
import { ClientCategory, ClientProduct, ClientShop } from './models/home.models';

@Component({
  selector: 'app-client-home',
  standalone: true,
  imports: [NgFor, NgClass, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class ClientHomeComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly categoriesBaseUrl = 'http://localhost:3000/api/categories';
  private readonly shopsBaseUrl = 'http://localhost:3000/api/shops';
  private readonly productsBaseUrl = 'http://localhost:3000/api/products';

  categories: ClientCategory[] = [...CLIENT_CATEGORIES];
  shops: ClientShop[] = [...CLIENT_SHOPS];
  products: ClientProduct[] = [];
  shopsLoading = false;
  productsLoading = false;
  readonly deals = CLIENT_DEALS;
  readonly services = CLIENT_SERVICES;
  readonly stars = Array.from({ length: 5 });

  selectedCategory = 'all';
  cartCount = 0;
  favoriteProductIds = new Set<string | number>();
  timerDays = '00';
  timerHours = '00';
  timerMinutes = '00';
  timerSeconds = '00';

  private readonly countdownTarget = new Date(Date.now() + (3 * 86400 + 14 * 3600 + 27 * 60) * 1000);
  private timerId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadShopCategories();
    this.loadShops();
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
      return this.shops;
    }

    return this.shops.filter(
      (shop) => this.toCategoryKey(shop.category) === this.selectedCategory
    );
  }

  get filteredProducts(): ClientProduct[] {
    if (this.selectedCategory === 'all') {
      return this.products;
    }

    return this.products.filter(
      (product) => this.toCategoryKey(product.category) === this.selectedCategory
    );
  }

  setCategory(category: ClientCategory): void {
    this.selectedCategory = category.key;
  }

  addToCart(): void {
    this.cartCount += 1;
  }

  toggleFavorite(productId: string | number): void {
    if (this.favoriteProductIds.has(productId)) {
      this.favoriteProductIds.delete(productId);
      return;
    }

    this.favoriteProductIds.add(productId);
  }

  isFavorite(productId: string | number): boolean {
    return this.favoriteProductIds.has(productId);
  }

  trackById(_: number, item: { id: string | number }): string | number {
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

  private loadShopCategories(): void {
    this.http
      .get<{ categories?: Array<{ _id: string; name: string; type: 'shop' | 'product' }> }>(
        `${this.categoriesBaseUrl}/type/shop`
      )
      .subscribe({
        next: (response) => {
          const apiCategories = (response?.categories || [])
            .filter((category) => category?.name)
            .map((category) => ({
              key: this.toCategoryKey(category.name),
              label: category.name,
              icon: this.getCategoryIcon(category.name),
            }))
            .filter((category) => category.key && category.key !== 'all');

          if (apiCategories.length === 0) {
            this.categories = [...CLIENT_CATEGORIES];
            return;
          }

          const uniqueCategories = Array.from(
            new Map(apiCategories.map((item) => [item.key, item])).values()
          );
          this.categories = [
            { key: 'all', label: 'Toutes', icon: '\u{1F9ED}' },
            ...uniqueCategories,
          ];
        },
        error: () => {
          this.categories = [...CLIENT_CATEGORIES];
        },
      });
  }

  private loadShops(): void {
    this.shopsLoading = true;
    this.http
      .get<{
        shops?: Array<{
          _id: string;
          name?: string;
          location?: string;
          isOpen?: boolean;
          categoryId?: string | { _id?: string; name?: string; type?: 'shop' | 'product' };
        }>;
      }>(this.shopsBaseUrl)
      .subscribe({
        next: (response) => {
          const apiShops = (response?.shops || [])
            .filter((shop) => shop?._id && shop?.name)
            .map((shop) => {
              const categoryName = this.extractCategoryName(shop.categoryId);
              const categoryKey = this.toCategoryKey(categoryName);
              return {
                id: shop._id,
                name: String(shop.name),
                category: categoryName,
                floor: shop.location?.trim() || 'Niveau non précisé',
                rating: this.getShopRating(shop._id),
                hours: '09:00 - 21:00',
                isOpen: !!shop.isOpen,
                icon: this.getCategoryIcon(categoryName),
                gradient: this.getCategoryGradient(categoryKey),
              };
            });

          this.shops = apiShops.length > 0 ? apiShops : [...CLIENT_SHOPS];
          this.shopsLoading = false;
          this.loadProducts();
        },
        error: () => {
          this.shops = [...CLIENT_SHOPS];
          this.shopsLoading = false;
          this.loadProducts();
        },
      });
  }

  private loadProducts(): void {
    this.productsLoading = true;
    this.http
      .get<{
        products?: Array<{
          _id: string;
          shopId?: string | { _id?: string; name?: string };
          categoryId?: string | { _id?: string; name?: string; type?: 'shop' | 'product' };
          name?: string;
          price?: number;
          stock?: number;
          isActive?: boolean;
        }>;
      }>(this.productsBaseUrl)
      .subscribe({
        next: (response) => {
          const apiProducts = (response?.products || [])
            .filter((product) => product?._id && product?.name && product?.isActive !== false)
            .map((product) => {
              const shopId = this.extractRefId(product.shopId);
              const linkedShop = this.shops.find((shop) => String(shop.id) === shopId);
              const categoryFromProduct = this.extractCategoryName(product.categoryId);
              const categoryName =
                categoryFromProduct !== 'Autres'
                  ? categoryFromProduct
                  : linkedShop?.category || 'Autres';
              const categoryKey = this.toCategoryKey(categoryName);
              const stock = Number(product.stock ?? 0);
              const priceValue = Number(product.price ?? 0);
              const isLowStock = stock > 0 && stock <= 5;

              return {
                id: product._id,
                shop: this.extractShopName(product.shopId) || linkedShop?.name || 'Boutique',
                name: String(product.name),
                category: categoryName,
                price: this.formatEurPrice(priceValue),
                oldPrice: isLowStock ? this.formatEurPrice(priceValue * 1.15) : undefined,
                badge: isLowStock ? 'Stock limité' : stock >= 20 ? 'Top' : 'Nouveau',
                badgeType: isLowStock ? 'promo' : stock >= 20 ? 'exclusive' : 'new',
                icon: this.getCategoryIcon(categoryName),
                gradient: this.getCategoryGradient(categoryKey),
              } as ClientProduct;
            });

          this.products = apiProducts;
          this.productsLoading = false;
        },
        error: () => {
          this.products = [];
          this.productsLoading = false;
        },
      });
  }

  private toCategoryKey(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getCategoryIcon(categoryName: string): string {
    const normalized = this.toCategoryKey(categoryName);

    if (/(mode|fashion|vetement|style)/.test(normalized)) return '\u{1F457}';
    if (/(beaute|beauty|cosmetique|soin|parfum)/.test(normalized)) return '\u{1F484}';
    if (/(tech|technologie|electronique|high-tech|hightech)/.test(normalized)) return '\u{1F4F1}';
    if (/(sport|fitness|runner|running)/.test(normalized)) return '\u{1F3C3}';
    if (/(food|restauration|restaurant|cafe|coffee|snack)/.test(normalized)) return '\u{1F37D}';

    return '\u{1F6CD}';
  }

  private getCategoryGradient(categoryKey: string): string {
    if (/(mode|fashion|vetement|style)/.test(categoryKey)) return 'linear-gradient(135deg,#e6ddf5,#cab6e8)';
    if (/(beaute|beauty|cosmetique|soin|parfum)/.test(categoryKey))
      return 'linear-gradient(135deg,#f5e1ea,#e8c0d8)';
    if (/(tech|technologie|electronique|high-tech|hightech)/.test(categoryKey))
      return 'linear-gradient(135deg,#dde8fb,#bcd0f4)';
    if (/(sport|fitness|runner|running)/.test(categoryKey)) return 'linear-gradient(135deg,#e4f0df,#c8e1b9)';
    if (/(food|restauration|restaurant|cafe|coffee|snack)/.test(categoryKey))
      return 'linear-gradient(135deg,#f6eadf,#e8cdb1)';

    return 'linear-gradient(135deg,#ece7f3,#d7cfe8)';
  }

  private extractCategoryName(
    category: string | { _id?: string; name?: string; type?: 'shop' | 'product' } | undefined
  ): string {
    if (category && typeof category === 'object' && category.name) {
      return String(category.name);
    }
    if (typeof category === 'string' && category.trim()) {
      return category;
    }
    return 'Autres';
  }

  private extractShopName(shop: string | { _id?: string; name?: string } | undefined): string {
    if (shop && typeof shop === 'object' && shop.name) {
      return String(shop.name);
    }
    return '';
  }

  private extractRefId(ref: string | { _id?: string } | undefined): string {
    if (ref && typeof ref === 'object' && ref._id) {
      return String(ref._id);
    }
    if (typeof ref === 'string') {
      return ref;
    }
    return '';
  }

  private formatEurPrice(value: number): string {
    const safeValue = Number.isFinite(value) ? value : 0;
    return `${Math.round(safeValue)} EUR`;
  }

  private getShopRating(shopId: string): number {
    const hash = shopId
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Number((4.2 + (hash % 8) * 0.1).toFixed(1));
  }
}
