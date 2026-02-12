import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import {
  Product,
  ProductCategory,
  ProductPayload,
  ShopOption,
  ShopkeeperProductsService,
} from './products.service';

type AvailabilityFilter = 'all' | 'inStock' | 'outOfStock';

@Component({
  selector: 'app-shopkeeper-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
})
export class ShopkeeperProductsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productsService = inject(ShopkeeperProductsService);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.maxLength(500)]],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    shopId: ['', [Validators.required]],
    categoryId: ['', [Validators.required]],
    images: [''],
    isActive: [true, [Validators.required]],
  });

  products = signal<Product[]>([]);
  categoryOptions = signal<ProductCategory[]>([]);
  shopOptions = signal<ShopOption[]>([]);

  loadingData = signal(false);
  saving = signal(false);
  deletingId = signal<string | null>(null);
  selectedProductId = signal<string | null>(null);

  serverErrors = signal<string[]>([]);
  successMessage = signal<string | null>(null);

  searchTerm = signal('');
  categoryFilter = signal('all');
  availabilityFilter = signal<AvailabilityFilter>('all');
  currentPage = signal(1);
  readonly pageSize = 8;

  readonly loggedUserId = signal<string | null>(this.extractLoggedUserId());
  readonly loggedUserRole = signal<string | null>(this.extractLoggedUserRole());

  readonly visibleProducts = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const category = this.categoryFilter();
    const availability = this.availabilityFilter();

    return this.products().filter((product) => {
      const stock = Number(product.stock || 0);
      if (availability === 'inStock' && stock <= 0) return false;
      if (availability === 'outOfStock' && stock > 0) return false;

      const categoryId = this.extractCategoryId(product);
      if (category !== 'all' && categoryId !== category) return false;

      if (!search) return true;

      return (
        (product.name || '').toLowerCase().includes(search) ||
        (product.description || '').toLowerCase().includes(search) ||
        this.getCategoryName(product).toLowerCase().includes(search) ||
        this.getShopName(product).toLowerCase().includes(search)
      );
    });
  });

  readonly totalPages = computed(() => {
    const total = Math.ceil(this.visibleProducts().length / this.pageSize);
    return total > 0 ? total : 1;
  });

  readonly paginatedProducts = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.visibleProducts().slice(start, start + this.pageSize);
  });

  readonly totalProducts = computed(() => this.products().length);
  readonly inStockProducts = computed(
    () => this.products().filter((item) => Number(item.stock || 0) > 0).length
  );
  readonly outOfStockProducts = computed(
    () => this.products().filter((item) => Number(item.stock || 0) <= 0).length
  );

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loadingData.set(true);
    this.serverErrors.set([]);

    forkJoin({
      productsResponse: this.productsService.getProducts(),
      categoriesResponse: this.productsService.getProductCategories(),
      shopsResponse: this.productsService.getShops(),
    })
      .pipe(finalize(() => this.loadingData.set(false)))
      .subscribe({
        next: ({ productsResponse, categoriesResponse, shopsResponse }) => {
          const allowedShops = this.filterShopsForCurrentUser(shopsResponse.shops || []);
          const allowedShopIds = new Set(allowedShops.map((shop) => shop._id));

          const filteredProducts = (productsResponse.products || []).filter((product) => {
            const shopId = this.extractShopId(product);
            return allowedShopIds.has(shopId);
          });

          this.products.set(filteredProducts);
          this.categoryOptions.set(categoriesResponse.categories || []);
          this.shopOptions.set(allowedShops);
          this.currentPage.set(1);
        },
        error: (error) => {
          this.serverErrors.set(this.parseApiErrors(error));
        },
      });
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.toPayload();
    const selectedId = this.selectedProductId();
    const request$ = selectedId
      ? this.productsService.updateProduct(selectedId, payload)
      : this.productsService.createProduct(payload);

    this.saving.set(true);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.successMessage.set(
          selectedId ? 'Product updated successfully.' : 'Product created successfully.'
        );
        this.resetForm();
        this.loadData();
      },
      error: (error) => {
        this.serverErrors.set(this.parseApiErrors(error));
      },
    });
  }

  editProduct(product: Product): void {
    this.selectedProductId.set(product._id);
    this.successMessage.set(null);
    this.serverErrors.set([]);

    this.form.patchValue({
      name: product.name || '',
      description: product.description || '',
      price: Number(product.price || 0),
      stock: Number(product.stock || 0),
      shopId: this.extractShopId(product),
      categoryId: this.extractCategoryId(product),
      images: (product.images || []).join(', '),
      isActive: !!product.isActive,
    });
    this.form.markAsPristine();
  }

  deleteProduct(productId: string): void {
    if (this.deletingId()) return;
    if (!confirm('Delete this product permanently?')) return;

    this.deletingId.set(productId);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    this.productsService
      .deleteProduct(productId)
      .pipe(finalize(() => this.deletingId.set(null)))
      .subscribe({
        next: () => {
          this.successMessage.set('Product deleted successfully.');
          if (this.selectedProductId() === productId) {
            this.resetForm();
          }
          this.loadData();
        },
        error: (error) => {
          this.serverErrors.set(this.parseApiErrors(error));
        },
      });
  }

  resetForm(): void {
    this.selectedProductId.set(null);
    this.form.reset({
      name: '',
      description: '',
      price: 0,
      stock: 0,
      shopId: this.shopOptions()[0]?._id || '',
      categoryId: '',
      images: '',
      isActive: true,
    });
    this.form.markAsPristine();
  }

  updateSearch(value: string): void {
    this.searchTerm.set(value || '');
    this.currentPage.set(1);
  }

  setCategoryFilter(value: string): void {
    this.categoryFilter.set(value || 'all');
    this.currentPage.set(1);
  }

  setAvailabilityFilter(value: AvailabilityFilter): void {
    this.availabilityFilter.set(value || 'all');
    this.currentPage.set(1);
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  hasError(controlName: string, errorKey?: string): boolean {
    const control = this.form.get(controlName);
    if (!control) return false;
    if (!control.touched && !control.dirty) return false;
    return errorKey ? !!control.errors?.[errorKey] : !!control.errors;
  }

  getCategoryName(product: Product): string {
    const category = product.categoryId;
    if (typeof category !== 'string') {
      return category?.name || 'Unknown';
    }
    const match = this.categoryOptions().find((item) => item._id === category);
    return match?.name || category;
  }

  getShopName(product: Product): string {
    const shop = product.shopId;
    if (typeof shop !== 'string') {
      return shop?.name || 'Unknown';
    }
    const match = this.shopOptions().find((item) => item._id === shop);
    return match?.name || shop;
  }

  getProductImage(product: Product): string {
    const image = (product.images || []).find((item) => item && item.trim().length > 0);
    return image || '';
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  trackByProductId(_index: number, product: Product): string {
    return product._id;
  }

  get isEditMode(): boolean {
    return !!this.selectedProductId();
  }

  private extractShopId(product: Product): string {
    return typeof product.shopId === 'string' ? product.shopId : product.shopId?._id || '';
  }

  private extractCategoryId(product: Product): string {
    return typeof product.categoryId === 'string'
      ? product.categoryId
      : product.categoryId?._id || '';
  }

  private toPayload(): ProductPayload {
    return {
      name: String(this.form.value.name || '').trim(),
      description: this.toOptionalString(this.form.value.description),
      price: Number(this.form.value.price || 0),
      stock: Number(this.form.value.stock || 0),
      shopId: String(this.form.value.shopId || '').trim(),
      categoryId: String(this.form.value.categoryId || '').trim(),
      images: this.parseImages(this.form.value.images),
      isActive: !!this.form.value.isActive,
    };
  }

  private toOptionalString(value: unknown): string | undefined {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private parseImages(value: unknown): string[] | undefined {
    const items = String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return items.length > 0 ? items : undefined;
  }

  private filterShopsForCurrentUser(shops: ShopOption[]): ShopOption[] {
    const userId = this.loggedUserId();
    const role = (this.loggedUserRole() || '').toLowerCase();
    if (!userId || role !== 'shopkeeper') {
      return shops;
    }

    return shops.filter((shop) => {
      const merchant = shop.merchantId;
      if (typeof merchant === 'string') return merchant === userId;
      return merchant?._id === userId;
    });
  }

  private extractLoggedUserId(): string | null {
    try {
      const raw = localStorage.getItem('auth_user');
      if (!raw) return null;
      const user = JSON.parse(raw);
      return user?._id || user?.id || null;
    } catch {
      return null;
    }
  }

  private extractLoggedUserRole(): string | null {
    try {
      const raw = localStorage.getItem('auth_user');
      if (!raw) return null;
      const user = JSON.parse(raw);
      return user?.role || null;
    } catch {
      return null;
    }
  }

  private parseApiErrors(error: any): string[] {
    const apiErrors: string[] = [];

    if (error?.error?.errors && Array.isArray(error.error.errors)) {
      apiErrors.push(...error.error.errors);
      return apiErrors;
    }

    if (error?.error?.message) {
      apiErrors.push(error.error.message);
      return apiErrors;
    }

    switch (error?.status) {
      case 400:
        apiErrors.push('Please check the form fields and try again.');
        break;
      case 404:
        apiErrors.push('Related shop or category was not found.');
        break;
      case 0:
        apiErrors.push('Unable to reach the server. Please check your connection.');
        break;
      default:
        apiErrors.push('An unexpected error occurred. Please try again.');
        break;
    }

    return apiErrors;
  }
}
