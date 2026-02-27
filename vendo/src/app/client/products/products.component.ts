import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Product,
  ProductCategory,
  ShopOption,
  ShopkeeperProductsService,
} from '../../shopkeeper/products/products.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-client-products',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
})
export class ClientProductsComponent implements OnInit {
  private readonly productsService = inject(ShopkeeperProductsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  cartCount = 0;
  isMenuOpen = false;

  readonly loading = signal(true);
  readonly serverError = signal<string | null>(null);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<ProductCategory[]>([]);
  readonly shops = signal<ShopOption[]>([]);

  readonly selectedCategory = signal('all');
  readonly selectedShop = signal('all');
  readonly searchTerm = signal('');

  readonly filteredProducts = computed(() => {
    const category = this.selectedCategory();
    const shop = this.selectedShop();
    const search = this.searchTerm().trim().toLowerCase();

    return this.products().filter((product) => {
      const productCategoryId = this.extractCategoryId(product);
      const productShopId = this.extractShopId(product);
      const productShopName = this.getProductShopName(product).toLowerCase();
      const productCategoryName = this.getProductCategoryName(product).toLowerCase();
      const productName = (product.name || '').toLowerCase();

      if (category !== 'all' && productCategoryId !== category) {
        return false;
      }

      if (shop !== 'all' && productShopId !== shop) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        productName.includes(search) ||
        productShopName.includes(search) ||
        productCategoryName.includes(search)
      );
    });
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const category = params.get('category');
      const shop = params.get('shop');
      const search = params.get('search');

      this.selectedCategory.set(category && category.trim() ? category : 'all');
      this.selectedShop.set(shop && shop.trim() ? shop : 'all');
      this.searchTerm.set(search || '');
    });

    this.loadData();
  }

  setCategory(categoryId: string): void {
    this.selectedCategory.set(categoryId);
    this.updateQueryParams();
  }

  setShop(shopId: string): void {
    this.selectedShop.set(shopId);
    this.updateQueryParams();
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value || '');
    this.updateQueryParams();
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

  getProductCategoryName(product: Product): string {
    const category = product.categoryId;
    if (typeof category === 'string') {
      const found = this.categories().find((item) => item._id === category);
      return found?.name || 'Categorie';
    }
    return category?.name || 'Categorie';
  }

  getProductShopName(product: Product): string {
    const shop = product.shopId;
    if (typeof shop === 'string') {
      const found = this.shops().find((item) => item._id === shop);
      return found?.name || 'Boutique';
    }
    return shop?.name || 'Boutique';
  }

  getProductImageUrl(product: Product): string | null {
    const images = Array.isArray(product.images) ? product.images : [];
    if (!images.length) {
      return null;
    }
    const first = images[0];
    return typeof first === 'string' && first.trim().length > 0 ? first : null;
  }

  private loadData(): void {
    this.loading.set(true);
    this.serverError.set(null);

    this.productsService.getProducts().subscribe({
      next: (response) => {
        this.products.set(response?.products || []);
        this.loading.set(false);
      },
      error: () => {
        this.serverError.set('Impossible de charger les produits.');
        this.loading.set(false);
      },
    });

    this.productsService.getProductCategories().subscribe({
      next: (response) => {
        this.categories.set(response?.categories || []);
      },
      error: () => {
        this.categories.set([]);
      },
    });

    this.productsService.getShops().subscribe({
      next: (response) => {
        this.shops.set(response?.shops || []);
      },
      error: () => {
        this.shops.set([]);
      },
    });
  }

  private extractCategoryId(product: Product): string {
    const category = product.categoryId;
    return typeof category === 'string' ? category : String(category?._id || '');
  }

  private extractShopId(product: Product): string {
    const shop = product.shopId;
    return typeof shop === 'string' ? shop : String(shop?._id || '');
  }

  private updateQueryParams(): void {
    const category = this.selectedCategory();
    const shop = this.selectedShop();
    const search = this.searchTerm().trim();

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: category !== 'all' ? category : null,
        shop: shop !== 'all' ? shop : null,
        search: search || null,
      },
      queryParamsHandling: 'merge',
    });
  }
}
