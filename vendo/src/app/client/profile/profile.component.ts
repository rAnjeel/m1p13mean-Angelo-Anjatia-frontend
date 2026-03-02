import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Shop } from '../../admin/shops/shops.service';
import { Product, ShopkeeperProductsService } from '../../shopkeeper/products/products.service';
import { Favorite, FavoritesService } from '../shared/favorites.service';
import { ProductReview, ProductReviewsService } from '../shared/product-reviews.service';
import { environment } from '../../../environments/environment';

interface ClientStat {
  label: string;
  value: string;
}

interface ConnectedUser {
  _id?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  createdAt?: string;
}

interface FavoriteShopItem {
  id: string;
  name: string;
  description: string;
  location: string;
}

interface ClientReviewItem {
  id: string;
  productName: string;
  shopName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ClientProfileComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly favoritesService = inject(FavoritesService);
  private readonly productsService = inject(ShopkeeperProductsService);
  private readonly reviewsService = inject(ProductReviewsService);

  private readonly authBaseUrl = `${environment.apiUrl}/auth`;
  private readonly userStorageKey = 'auth_user';
  private readonly profilePhotoStorageKey = 'profile_photo_data_url';

  readonly loading = signal(true);
  readonly serverError = signal<string | null>(null);
  readonly user = signal<ConnectedUser | null>(null);
  readonly profilePhoto = signal<string | null>(null);

  readonly favoritesLoading = signal(false);
  readonly favoritesError = signal<string | null>(null);
  readonly favoriteShops = signal<FavoriteShopItem[]>([]);

  readonly reviewsLoading = signal(false);
  readonly reviewsError = signal<string | null>(null);
  readonly clientReviews = signal<ClientReviewItem[]>([]);

  readonly averageRating = computed(() => {
    const reviews = this.clientReviews();
    if (!reviews.length) return 0;
    const total = reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0);
    return total / reviews.length;
  });

  readonly stats = computed<ClientStat[]>(() => {
    const joinedYear = this.getJoinedYear();
    return [
      { label: 'Boutiques favorites', value: String(this.favoriteShops().length) },
      { label: 'Avis publiés', value: String(this.clientReviews().length) },
      { label: 'Note moyenne', value: this.clientReviews().length ? `${this.averageRating().toFixed(1)}/5` : '-' },
      { label: 'Membre depuis', value: joinedYear || '-' },
    ];
  });

  ngOnInit(): void {
    this.profilePhoto.set(this.readStoredProfilePhoto());
    this.loadProfile();
  }

  get displayName(): string {
    return this.user()?.fullName?.trim() || 'Utilisateur';
  }

  get displayEmail(): string {
    return this.user()?.email?.trim() || 'E-mail non renseigné';
  }

  get displayPhone(): string {
    return this.user()?.phone?.trim() || 'Téléphone non renseigné';
  }

  get aboutClientText(): string {
    const name = this.displayName;
    const joined = this.formatUserJoinDate();
    const phone = this.user()?.phone?.trim();
    const phoneInfo = phone ? `Vous pouvez le contacter au ${phone}.` : 'Le numéro de téléphone n\'est pas encore renseigné.';
    return `${name} est un client actif sur Vendeo${joined ? ` depuis ${joined}` : ''}. ${phoneInfo}`;
  }

  get userInitials(): string {
    const fullName = (this.user()?.fullName || '').trim();
    if (!fullName) {
      return 'U';
    }
    const parts = fullName.split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || '';
    const second = parts[1]?.charAt(0) || '';
    return `${first}${second}`.toUpperCase() || first.toUpperCase() || 'U';
  }

  renderStars(rating: number): string {
    const safe = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return `${'★'.repeat(safe)}${'☆'.repeat(5 - safe)}`;
  }

  formatLongDate(value: string): string {
    if (!value) return 'Date inconnue';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date inconnue';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private loadProfile(): void {
    this.loading.set(true);
    this.serverError.set(null);

    const localUser = this.readStoredUser();
    if (localUser) {
      this.user.set(localUser);
      this.loadClientExtras(localUser);
    }

    this.http.get<{ user?: ConnectedUser }>(`${this.authBaseUrl}/me`).subscribe({
      next: (response) => {
        const apiUser = response?.user ?? localUser;
        if (apiUser) {
          this.user.set(apiUser);
          this.persistUser(apiUser);
          this.loadClientExtras(apiUser);
        }
        this.loading.set(false);
      },
      error: () => {
        if (!localUser) {
          this.serverError.set('Impossible de charger le profil utilisateur.');
        }
        this.loading.set(false);
      },
    });
  }

  private loadClientExtras(user: ConnectedUser): void {
    this.loadFavoriteShops();
    this.loadClientReviews(user);
  }

  private loadFavoriteShops(): void {
    this.favoritesLoading.set(true);
    this.favoritesError.set(null);

    this.favoritesService
      .getFavorites()
      .pipe(catchError(() => of({ favorites: [] as Favorite[] })))
      .subscribe({
        next: (response) => {
          const mapped = (response?.favorites || [])
            .map((favorite) => this.mapFavoriteToShop(favorite))
            .filter((item): item is FavoriteShopItem => !!item);
          this.favoriteShops.set(mapped);
          this.favoritesLoading.set(false);
        },
        error: () => {
          this.favoritesError.set('Impossible de charger les boutiques favorites.');
          this.favoritesLoading.set(false);
        },
      });
  }

  private loadClientReviews(user: ConnectedUser): void {
    const userId = String(user?._id || '').trim();
    if (!userId) {
      this.clientReviews.set([]);
      return;
    }

    this.reviewsLoading.set(true);
    this.reviewsError.set(null);

    this.productsService
      .getProducts()
      .pipe(
        switchMap((response) => {
          const products = response?.products || [];
          if (!products.length) {
            return of([] as Array<{ product: Product; reviews: ProductReview[] }>);
          }

          const requests = products.map((product) =>
            this.reviewsService.getByProduct(product._id).pipe(
              map((reviewsResponse) => ({ product, reviews: reviewsResponse?.reviews || [] })),
              catchError(() => of({ product, reviews: [] as ProductReview[] }))
            )
          );

          return forkJoin(requests);
        }),
        map((items) => {
          const reviews: ClientReviewItem[] = [];

          items.forEach(({ product, reviews: productReviews }) => {
            productReviews.forEach((review) => {
              if (!this.reviewBelongsToUser(review, userId)) {
                return;
              }

              reviews.push({
                id: String(review?._id || `${product._id}-${review.createdAt || ''}`),
                productName: product?.name || 'Produit',
                shopName: this.extractProductShopName(product),
                rating: Number(review?.rating || 0),
                comment: String(review?.comment || '').trim(),
                createdAt: String(review?.createdAt || ''),
              });
            });
          });

          return reviews.sort((a, b) => {
            const left = new Date(a.createdAt).getTime();
            const right = new Date(b.createdAt).getTime();
            return right - left;
          });
        }),
        catchError(() => {
          this.reviewsError.set('Impossible de charger les avis du client.');
          return of([] as ClientReviewItem[]);
        })
      )
      .subscribe((reviews) => {
        this.clientReviews.set(reviews);
        this.reviewsLoading.set(false);
      });
  }

  private mapFavoriteToShop(favorite: Favorite): FavoriteShopItem | null {
    const shop = favorite?.shopId;
    if (!shop || typeof shop === 'string') {
      return null;
    }

    const ref = shop as Partial<Shop>;
    return {
      id: String(ref._id || ''),
      name: String(ref.name || 'Boutique sans nom'),
      description: String(ref.description || 'Aucune description disponible.'),
      location: String(ref.location || 'Localisation non renseignée'),
    };
  }

  private reviewBelongsToUser(review: ProductReview, userId: string): boolean {
    const client = review?.clientId;
    if (!client) return false;
    if (typeof client === 'string') return client === userId;
    return String(client?._id || '') === userId;
  }

  private extractProductShopName(product: Product): string {
    const shop = product?.shopId;
    if (!shop) return 'Boutique';
    if (typeof shop === 'string') return 'Boutique';
    return String(shop?.name || 'Boutique');
  }

  private formatUserJoinDate(): string {
    const createdAt = this.user()?.createdAt;
    if (!createdAt) return '';

    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  }

  private getJoinedYear(): string {
    const createdAt = this.user()?.createdAt;
    if (!createdAt) return '';

    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';
    return String(date.getFullYear());
  }

  private readStoredUser(): ConnectedUser | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }

    const raw = localStorage.getItem(this.userStorageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as ConnectedUser;
    } catch {
      return null;
    }
  }

  private persistUser(user: ConnectedUser): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(this.userStorageKey, JSON.stringify(user));
  }

  private readStoredProfilePhoto(): string | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }
    const value = localStorage.getItem(this.profilePhotoStorageKey);
    return value?.trim() || null;
  }
}



