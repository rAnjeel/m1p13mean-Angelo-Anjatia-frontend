import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Shop, ShopCategory, ShopsService } from '../../admin/shops/shops.service';
import { FavoritesService } from '../shared/favorites.service';
import { catchError, of } from 'rxjs';
import { ShopReview, ShopReviewsService } from '../shared/shop-reviews.service';

@Component({
  selector: 'app-client-shops',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shops.component.html',
  styleUrl: './shops.component.css',
})
export class ClientShopsComponent implements OnInit {
  private readonly shopsService = inject(ShopsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly favoritesService = inject(FavoritesService);
  private readonly shopReviewsService = inject(ShopReviewsService);

  readonly loading = signal(true);
  readonly serverError = signal<string | null>(null);
  readonly shops = signal<Shop[]>([]);
  readonly categories = signal<ShopCategory[]>([]);
  readonly favoriteShopIds = signal<Set<string>>(new Set());
  readonly favoritePendingIds = signal<Set<string>>(new Set());

  readonly searchTerm = signal('');
  readonly selectedCategory = signal('all');
  readonly selectedShopId = signal<string | null>(null);
  readonly selectedShopForReview = signal<Shop | null>(null);
  readonly shopReviews = signal<ShopReview[]>([]);
  readonly reviewLoading = signal(false);
  readonly reviewSubmitting = signal(false);
  readonly reviewError = signal<string | null>(null);
  readonly reviewSuccess = signal<string | null>(null);
  readonly reviewRating = signal(0);
  readonly reviewComment = signal('');
  readonly stars = [1, 2, 3, 4, 5];

  readonly filteredShops = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const category = this.selectedCategory();

    const filtered = this.shops().filter((shop) => {
      const shopCategoryId = this.extractCategoryId(shop);
      const shopCategoryName = this.getShopCategoryName(shop).toLowerCase();
      const shopLocation = (shop.location || '').toLowerCase();
      const shopName = (shop.name || '').toLowerCase();

      const matchCategory =
        category === 'all' || shopCategoryId === category || shopCategoryName === category.toLowerCase();
      if (!matchCategory) {
        return false;
      }

      if (!search) {
        return true;
      }

      return shopName.includes(search) || shopLocation.includes(search) || shopCategoryName.includes(search);
    });

    const favoriteIds = this.favoriteShopIds();
    return [...filtered].sort((left, right) => {
      const leftFav = favoriteIds.has(String(left?._id || ''));
      const rightFav = favoriteIds.has(String(right?._id || ''));
      if (leftFav === rightFav) return 0;
      return leftFav ? -1 : 1;
    });
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const category = params.get('category');
      const search = params.get('search');
      const shopId = params.get('shop');

      this.selectedCategory.set(category && category.trim() ? category : 'all');
      this.searchTerm.set(search || '');
      this.selectedShopId.set(shopId && shopId.trim() ? shopId : null);
    });

    this.loadData();
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
    this.updateQueryParams();
  }

  setCategory(categoryId: string): void {
    this.selectedCategory.set(categoryId);
    this.updateQueryParams();
  }

  openShop(shop: Shop): void {
    this.selectedShopId.set(shop._id);
    void this.router.navigate(['/client/products'], {
      queryParams: { shop: shop._id },
    });
  }

  openShopReview(event: MouseEvent, shop: Shop): void {
    event.stopPropagation();
    this.selectedShopForReview.set(shop);
    this.reviewRating.set(0);
    this.reviewComment.set('');
    this.reviewError.set(null);
    this.reviewSuccess.set(null);
    this.loadShopReviews(shop._id);
  }

  closeShopReview(): void {
    this.selectedShopForReview.set(null);
    this.shopReviews.set([]);
    this.reviewLoading.set(false);
    this.reviewSubmitting.set(false);
    this.reviewError.set(null);
    this.reviewSuccess.set(null);
    this.reviewRating.set(0);
    this.reviewComment.set('');
  }

  setReviewRating(value: number): void {
    this.reviewRating.set(Math.min(5, Math.max(1, Number(value) || 0)));
  }

  updateReviewComment(value: string): void {
    this.reviewComment.set(String(value || ''));
  }

  submitShopReview(): void {
    const shop = this.selectedShopForReview();
    if (!shop || this.reviewSubmitting()) return;

    const rating = this.reviewRating();
    if (rating < 1 || rating > 5) {
      this.reviewError.set("Choisissez une note d'au moins 1 etoile.");
      return;
    }

    this.reviewSubmitting.set(true);
    this.reviewError.set(null);
    this.reviewSuccess.set(null);

    this.shopReviewsService
      .add(shop._id, { rating, comment: this.reviewComment().trim() })
      .subscribe({
        next: () => {
          this.reviewSubmitting.set(false);
          this.reviewSuccess.set('Votre avis boutique a ete enregistre.');
          this.reviewRating.set(0);
          this.reviewComment.set('');
          this.loadShopReviews(shop._id);
        },
        error: (error) => {
          this.reviewError.set(error?.error?.message || "Impossible d'envoyer votre avis.");
          this.reviewSubmitting.set(false);
        },
      });
  }

  getReviewClientName(review: ShopReview): string {
    const client = review?.clientId;
    if (typeof client === 'string') return 'Client';
    return String(client?.fullName || 'Client');
  }

  formatReviewDate(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  toggleFavorite(event: MouseEvent, shop: Shop): void {
    event.stopPropagation();
    const shopId = String(shop?._id || '').trim();
    if (!shopId || this.isFavoritePending(shopId)) return;

    const isFavorite = this.isFavorite(shop);
    this.setFavoritePending(shopId, true);

    const request$ = isFavorite
      ? this.favoritesService.removeFavorite(shopId)
      : this.favoritesService.addFavorite(shopId);

    request$.subscribe({
      next: () => {
        const next = new Set(this.favoriteShopIds());
        if (isFavorite) next.delete(shopId);
        else next.add(shopId);
        this.favoriteShopIds.set(next);
        this.setFavoritePending(shopId, false);
      },
      error: () => {
        this.setFavoritePending(shopId, false);
      },
    });
  }

  isFavorite(shop: Shop): boolean {
    return this.favoriteShopIds().has(String(shop?._id || ''));
  }

  isFavoritePending(shopId: string): boolean {
    return this.favoritePendingIds().has(String(shopId || '').trim());
  }

  isSelected(shop: Shop): boolean {
    return this.selectedShopId() === shop._id;
  }

  getShopImageUrl(shop: Shop): string | null {
    const anyShop = shop as Shop & {
      images?: Array<{ url?: string; isPrimary?: boolean }>;
    };
    const images = Array.isArray(anyShop.images) ? anyShop.images : [];
    if (!images.length) {
      return null;
    }
    const primary =
      images.find((image: { url?: string; isPrimary?: boolean }) => !!image && image.isPrimary) ?? images[0];
    return primary?.url || null;
  }

  getShopInitials(name: string | undefined | null): string {
    const value = (name || '').trim();
    if (!value) {
      return '?';
    }
    const parts = value.split(/\s+/);
    if (parts.length === 1) {
      return value.slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }

  getShopCategoryName(shop: Shop): string {
    const category = shop.categoryId;
    if (typeof category === 'string') {
      const found = this.categories().find((item) => item._id === category);
      return found?.name || 'Boutique';
    }
    return category?.name || 'Boutique';
  }

  private loadData(): void {
    this.loading.set(true);
    this.serverError.set(null);

    this.shopsService.getShopCategories().subscribe({
      next: (response) => {
        this.categories.set(response?.categories || []);
      },
      error: () => {
        this.categories.set([]);
      },
    });

    this.shopsService.getShops().subscribe({
      next: (response) => {
        this.shops.set(response?.shops || []);
        this.loading.set(false);
      },
      error: () => {
        this.serverError.set('Impossible de charger les boutiques.');
        this.loading.set(false);
      },
    });

    this.favoritesService
      .getFavorites()
      .pipe(catchError(() => of({ favorites: [] })))
      .subscribe({
        next: (response) => {
          const ids = new Set(this.favoritesService.extractShopIds(response?.favorites || []));
          this.favoriteShopIds.set(ids);
        },
      });
  }

  private loadShopReviews(shopId: string): void {
    this.reviewLoading.set(true);
    this.reviewError.set(null);

    this.shopReviewsService.getByShop(shopId).subscribe({
      next: (response) => {
        this.shopReviews.set(response?.reviews || []);
        this.reviewLoading.set(false);
      },
      error: () => {
        this.shopReviews.set([]);
        this.reviewLoading.set(false);
      },
    });
  }

  private extractCategoryId(shop: Shop): string {
    const category = shop.categoryId;
    return typeof category === 'string' ? category : String(category?._id || '');
  }

  private updateQueryParams(): void {
    const category = this.selectedCategory();
    const search = this.searchTerm().trim();
    const shop = this.selectedShopId();

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: category !== 'all' ? category : null,
        search: search || null,
        shop: shop || null,
      },
      queryParamsHandling: 'merge',
    });
  }

  private setFavoritePending(shopId: string, pending: boolean): void {
    const id = String(shopId || '').trim();
    if (!id) return;
    const next = new Set(this.favoritePendingIds());
    if (pending) next.add(id);
    else next.delete(id);
    this.favoritePendingIds.set(next);
  }
}
