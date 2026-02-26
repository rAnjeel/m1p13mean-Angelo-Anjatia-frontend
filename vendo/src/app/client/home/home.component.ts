import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { NgFor, NgIf, NgClass, DecimalPipe, AsyncPipe } from '@angular/common';
import { Observable, map } from 'rxjs';
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
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-client-home',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, DecimalPipe, AsyncPipe, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class ClientHomeComponent implements AfterViewInit {
  cartCount = 0;
  isMenuOpen = false;

  readonly shops$: Observable<Shop[]>;
  readonly products$: Observable<Product[]>;
  readonly productCategories$: Observable<ShopCategory[]>;

  private readonly isBrowser =
    typeof window !== 'undefined' && typeof document !== 'undefined';

  private readonly shopsService = inject(ShopsService);
  private readonly productsService = inject(ShopkeeperProductsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('cartBtn', { static: false })
  cartBtn!: ElementRef<HTMLDivElement>;

  constructor() {
    this.shops$ = this.shopsService
      .getShops()
      .pipe(map((response) => response?.shops ?? []));

    this.products$ = this.productsService
      .getProducts()
      .pipe(map((response) => response?.products ?? []));

    this.productCategories$ = this.shopsService
      .getShopCategories()
      .pipe(map((response) => response?.categories ?? []));
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
    const btn = this.cartBtn?.nativeElement;
    if (btn) {
      btn.style.transform = 'scale(1.25)';
      setTimeout(() => {
        btn.style.transform = 'scale(1)';
      }, 200);
    }
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
    const anyShop = shop as any;
    const images: any[] = Array.isArray(anyShop.images) ? anyShop.images : [];
    if (!images.length) {
      return null;
    }
    const primary = images.find((image) => image && image.isPrimary) ?? images[0];
    return primary?.url || null;
  }

  getShopInitials(name: string | undefined | null): string {
    if (!name) {
      return '?';
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return '?';
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return trimmed.slice(0, 2).toUpperCase();
    }
    const first = parts[0][0] ?? '';
    const second = parts[1][0] ?? '';
    const initials = `${first}${second}`;
    return initials.toUpperCase();
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

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.authService.clearSession();
        this.isMenuOpen = false;
        void this.router.navigateByUrl('/login');
      },
      error: () => {
        this.authService.clearSession();
        this.isMenuOpen = false;
        void this.router.navigateByUrl('/login');
      },
    });
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
}
