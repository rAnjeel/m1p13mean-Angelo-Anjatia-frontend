import {
  AfterViewInit,
  Component,
  OnInit,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { NgFor, NgIf, NgClass, DecimalPipe, AsyncPipe } from '@angular/common';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import {
  Shop,
  ShopCategory,
  ShopsService,
} from '../../admin/shops/shops.service';
import {
  Product,
  ShopkeeperProductsService,
} from '../../shopkeeper/products/products.service';
import { FavoritesService } from '../shared/favorites.service';

@Component({
  selector: 'app-client-home',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    NgClass,
    DecimalPipe,
    AsyncPipe,
    RouterLink,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class ClientHomeComponent implements OnInit, AfterViewInit {
  cartCount = 0;

  readonly shops = signal<Shop[]>([]);
  readonly favoriteShopIds = signal<Set<string>>(new Set());
  readonly favoritePendingIds = signal<Set<string>>(new Set());

  readonly products$: Observable<Product[]>;
  readonly productCategories$: Observable<ShopCategory[]>;

  private readonly isBrowser =
    typeof window !== 'undefined' && typeof document !== 'undefined';

  private readonly shopsService = inject(ShopsService);
  private readonly productsService = inject(ShopkeeperProductsService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly router = inject(Router);

  constructor() {
    this.products$ = this.productsService
      .getProducts()
      .pipe(
        map((response) => response?.products ?? []),
        map((products) =>
          [...products]
            .sort(
              (a, b) =>
                new Date(String(b?.createdAt || 0)).getTime() -
                new Date(String(a?.createdAt || 0)).getTime()
            )
            .slice(0, 4)
        )
      );

    this.productCategories$ = this.shopsService
      .getShopCategories()
      .pipe(map((response) => response?.categories ?? []));
  }

  ngOnInit(): void {
    this.loadShopsWithFavorites();
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      return;
    }
    this.initCarousels();
    this.initScrollEffects();
    this.initCountdown();
    this.initCategoryPills();
  }

  addToCart(): void {
    this.cartCount++;
  }

  openProductSearch(product: Product): void {
    const productName = String(product?.name || '').trim();
    void this.router.navigate(['/client/products'], {
      queryParams: {
        search: productName || null,
      },
    });
  }

  scrollTo(sectionId: string): void {
    if (!this.isBrowser) {
      return;
    }
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: 'smooth' });
  }

  getShopCategoryName(shop: Shop): string {
    const cat: unknown = shop.categoryId;
    if (cat && typeof cat === 'object' && 'name' in cat) {
      return (cat as { name: string }).name;
    }
    return 'Boutique';
  }

  getProductShopName(product: Product): string {
    const shopRef: unknown = product.shopId;
    if (shopRef && typeof shopRef === 'object' && 'name' in shopRef) {
      return (shopRef as { name: string }).name;
    }
    return 'Boutique';
  }

  getProductImageUrl(product: Product): string | null {
    const images = Array.isArray(product.images) ? product.images : [];
    if (!images.length) {
      return null;
    }
    const first = images[0];
    return typeof first === 'string' && first.trim().length > 0 ? first : null;
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

  toggleFav(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }
    target.classList.toggle('active');
    target.style.transform = 'scale(1.4)';
    setTimeout(() => {
      target.style.transform = 'scale(1)';
    }, 200);
  }

  toggleShopFavorite(event: MouseEvent, shop: Shop): void {
    event.preventDefault();
    event.stopPropagation();

    const shopId = String(shop?._id || '').trim();
    if (!shopId || this.isFavoritePending(shopId)) {
      return;
    }

    const isFavorite = this.isFavoriteShop(shopId);
    this.setFavoritePending(shopId, true);

    const request$ = isFavorite
      ? this.favoritesService.removeFavorite(shopId)
      : this.favoritesService.addFavorite(shopId);

    request$.subscribe({
      next: () => {
        const next = new Set(this.favoriteShopIds());
        if (isFavorite) {
          next.delete(shopId);
        } else {
          next.add(shopId);
        }
        this.favoriteShopIds.set(next);
        this.shops.set(this.sortShopsByFavorite(this.shops(), next));
        this.setFavoritePending(shopId, false);
      },
      error: () => {
        this.setFavoritePending(shopId, false);
      },
    });
  }

  isFavoriteShop(shopId: string): boolean {
    return this.favoriteShopIds().has(String(shopId || '').trim());
  }

  isFavoritePending(shopId: string): boolean {
    return this.favoritePendingIds().has(String(shopId || '').trim());
  }

  onCategoryClick(event: MouseEvent): void {
    const current = event.currentTarget as HTMLElement | null;
    if (!current) {
      return;
    }
    document.querySelectorAll('.cat-pill').forEach((pill) => {
      pill.classList.remove('active');
    });
    current.classList.add('active');
  }

  private initCarousels(): void {
    this.initCarousel('boutCarousel', 'boutPrev', 'boutNext');
    this.initCarousel('dealCarousel', 'dealPrev', 'dealNext');
  }

  private initCarousel(trackId: string, prevId: string, nextId: string): void {
    const track = document.getElementById(trackId);
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);

    if (!track || !prev || !next) {
      return;
    }

    const scrollAmount = () =>
      ((track.children[0] as HTMLElement | undefined)?.offsetWidth ?? 280) +
      22;

    next.addEventListener('click', () => {
      track.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
    });

    prev.addEventListener('click', () => {
      track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
    });

    // drag scroll
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    track.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
      (track as HTMLElement).style.userSelect = 'none';
    });

    track.addEventListener('mouseleave', () => {
      isDown = false;
    });

    track.addEventListener('mouseup', () => {
      isDown = false;
      (track as HTMLElement).style.userSelect = '';
    });

    track.addEventListener('mousemove', (e) => {
      if (!isDown) {
        return;
      }
      e.preventDefault();
      const x = e.pageX - track.offsetLeft;
      track.scrollLeft = scrollLeft - (x - startX);
    });
  }

  private initCountdown(): void {
    const endTime = new Date(
      Date.now() + (3 * 86400 + 14 * 3600 + 27 * 60) * 1000
    );

    const updateTimer = () => {
      const diff = Math.max(0, endTime.getTime() - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      const setValue = (id: string, value: string) => {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = value;
        }
      };

      setValue('tDays', String(d).padStart(2, '0'));
      setValue('tHours', String(h).padStart(2, '0'));
      setValue('tMins', String(m).padStart(2, '0'));
      setValue('tSecs', String(s).padStart(2, '0'));
    };

    updateTimer();
    setInterval(updateTimer, 1000);
  }

  private initScrollEffects(): void {
    window.addEventListener('scroll', () => {
      const navbar = document.getElementById('navbar');
      if (!navbar) {
        return;
      }
      navbar.style.boxShadow =
        window.scrollY > 20 ? '0 4px 30px rgba(46,40,64,.10)' : 'none';
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          }
        });
      },
      { threshold: 0.1 }
    );

    document
      .querySelectorAll('.product-card, .boutique-card, .service-card')
      .forEach((el) => {
        const element = el as HTMLElement;
        element.style.opacity = '0';
        element.style.transform = 'translateY(24px)';
        element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(element);
      });
  }

  private initCategoryPills(): void {
    const firstPill = document.querySelector('.cat-pill') as HTMLElement | null;
    if (firstPill) {
      firstPill.classList.add('active');
    }
  }

  private loadShopsWithFavorites(): void {
    forkJoin({
      shopsResponse: this.shopsService.getShops(),
      favoritesResponse: this.favoritesService.getFavorites().pipe(
        catchError(() => of({ favorites: [] }))
      ),
    }).subscribe({
      next: ({ shopsResponse, favoritesResponse }) => {
        const shops = shopsResponse?.shops || [];
        const favoriteIds = new Set(
          this.favoritesService.extractShopIds(favoritesResponse?.favorites || [])
        );
        this.favoriteShopIds.set(favoriteIds);
        this.shops.set(this.sortShopsByFavorite(shops, favoriteIds));
      },
      error: () => {
        this.shops.set([]);
        this.favoriteShopIds.set(new Set());
      },
    });
  }

  private sortShopsByFavorite(shops: Shop[], favoriteIds: Set<string>): Shop[] {
    return [...(shops || [])].sort((left, right) => {
      const leftFav = favoriteIds.has(String(left?._id || ''));
      const rightFav = favoriteIds.has(String(right?._id || ''));
      if (leftFav === rightFav) return 0;
      return leftFav ? -1 : 1;
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
