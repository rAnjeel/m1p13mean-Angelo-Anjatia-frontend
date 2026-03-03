import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, of, switchMap } from 'rxjs';
import {
  Product,
  ProductCategory,
  ProductReviewItem,
  ProductMutationResponse,
  ProductPayload,
  ShopOption,
  ShopkeeperProductsService,
} from './products.service';

type AvailabilityFilter = 'all' | 'inStock' | 'outOfStock';

@Component({
  selector: 'app-shopkeeper-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
})
export class ShopkeeperProductsComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly productsService = inject(ShopkeeperProductsService);
  private readonly allowedImageMimeTypes = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ]);
  private successMessageTimer: ReturnType<typeof setTimeout> | null = null;

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.maxLength(500)]],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    shopId: ['', [Validators.required]],
    categoryId: ['', [Validators.required]],
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
  selectedImageFiles = signal<File[]>([]);
  selectedImagePreviewUrls = signal<string[]>([]);
  existingImages = signal<string[]>([]);
  selectedProductForDetails = signal<Product | null>(null);
  reviewsLoading = signal(false);
  reviewsError = signal<string | null>(null);
  productReviews = signal<ProductReviewItem[]>([]);
  deletingReviewId = signal<string | null>(null);

  searchTerm = signal('');
  categoryFilter = signal('all');
  availabilityFilter = signal<AvailabilityFilter>('all');
  currentPage = signal(1);
  readonly pageSize = 6;

  readonly loggedUserId = signal<string | null>(this.extractLoggedUserId());
  readonly loggedUserRole = signal<string | null>(this.extractLoggedUserRole());
  readonly associatedShop = computed(() => this.shopOptions()[0] || null);
  readonly hasAssociatedShop = computed(() => !!this.associatedShop());
  readonly requiresShopAssociation = computed(() => {
    const role = (this.loggedUserRole() || '').toLowerCase();
    return role === 'shopkeeper' && !this.hasAssociatedShop();
  });

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
  readonly averageRating = computed(() => {
    const reviews = this.productReviews();
    if (!reviews.length) return 0;
    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return total / reviews.length;
  });

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.clearSelectedImageState();
    this.clearSuccessMessageTimer();
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
          this.applyShopAssociationState();
          this.currentPage.set(1);
        },
        error: (error) => {
          this.serverErrors.set(this.parseApiErrors(error));
        },
      });
  }

  onSubmit(): void {
    if (this.requiresShopAssociation()) {
      this.serverErrors.set([
        'No shop is associated with this shopkeeper. Link a shop from About > Shop Association.',
      ]);
      return;
    }

    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.toPayload();
    const selectedId = this.selectedProductId();
    const selectedFiles = this.selectedImageFiles();
    const shouldReplaceImages = !!selectedId;
    const request$ = selectedId
      ? this.productsService.updateProduct(selectedId, payload)
      : this.productsService.createProduct(payload);

    this.saving.set(true);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    request$
      .pipe(
        switchMap((response: ProductMutationResponse) => {
          if (selectedFiles.length === 0) {
            return of(response);
          }

          const productId = response?.product?._id || selectedId;
          if (!productId) {
            return of(response);
          }

          return this.productsService.uploadProductImages(
            productId,
            selectedFiles,
            shouldReplaceImages
          );
        }),
        finalize(() => this.saving.set(false))
      )
      .subscribe({
      next: () => {
        this.showSuccessMessage(
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

    this.existingImages.set(
      (product.images || [])
        .map((img) => this.extractImageUrl(img))
        .filter((url) => url.length > 0)
    );
    this.clearSelectedImageState();

    this.form.patchValue({
      name: product.name || '',
      description: product.description || '',
      price: Number(product.price || 0),
      stock: Number(product.stock || 0),
      shopId: this.extractShopId(product),
      categoryId: this.extractCategoryId(product),
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
          this.showSuccessMessage('Product deleted successfully.');
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

  openProductDetails(product: Product): void {
    this.selectedProductForDetails.set(product);
    this.loadProductReviews(product._id);
  }

  closeProductDetails(): void {
    this.selectedProductForDetails.set(null);
    this.productReviews.set([]);
    this.reviewsError.set(null);
    this.reviewsLoading.set(false);
    this.deletingReviewId.set(null);
  }

  deleteReview(reviewId: string): void {
    if (this.deletingReviewId()) return;
    if (!confirm('Delete this review?')) return;

    this.deletingReviewId.set(reviewId);
    this.reviewsError.set(null);

    this.productsService
      .deleteProductReview(reviewId)
      .pipe(finalize(() => this.deletingReviewId.set(null)))
      .subscribe({
        next: () => {
          this.productReviews.set(this.productReviews().filter((review) => review._id !== reviewId));
        },
        error: (error) => {
          this.reviewsError.set(error?.error?.message || 'Unable to delete this review.');
        },
      });
  }

  resetForm(): void {
    this.selectedProductId.set(null);
    this.clearSelectedImageState();
    this.existingImages.set([]);
    this.form.reset({
      name: '',
      description: '',
      price: 0,
      stock: 0,
      shopId: this.shopOptions()[0]?._id || '',
      categoryId: '',
      isActive: true,
    });
    this.applyShopAssociationState();
    this.form.markAsPristine();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = Array.from(input?.files || []);
    if (files.length === 0) {
      this.clearSelectedImageState();
      return;
    }

    if (files.length > 5) {
      this.serverErrors.set(['You can upload up to 5 images.']);
      this.clearSelectedImageState();
      return;
    }

    const invalidMime = files.some((file) => !this.allowedImageMimeTypes.has(file.type.toLowerCase()));
    if (invalidMime) {
      this.serverErrors.set(['Only jpg, jpeg, png and webp images are allowed.']);
      this.clearSelectedImageState();
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    const tooLarge = files.some((file) => file.size > maxSizeBytes);
    if (tooLarge) {
      this.serverErrors.set(['Each image must be smaller than 5MB.']);
      this.clearSelectedImageState();
      return;
    }

    this.clearSelectedImageState();
    this.selectedImageFiles.set(files);
    this.selectedImagePreviewUrls.set(files.map((file) => URL.createObjectURL(file)));
    this.serverErrors.set([]);
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
    const image = (product.images || [])
      .map((item) => this.extractImageUrl(item))
      .find((url) => url.length > 0);
    return image || '';
  }

  currentFormImagePreview(): string {
    return this.selectedImagePreviewUrls()[0] || this.existingImages()[0] || '';
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-MG', {
      style: 'currency',
      currency: 'MGA',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  formatReviewDate(value?: string): string {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getReviewClientName(review: ProductReviewItem): string {
    const client = review?.clientId;
    if (typeof client === 'string') return 'Client';
    return client?.fullName || 'Client';
  }

  renderStars(rating: number): string {
    const safeRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return `${'★'.repeat(safeRating)}${'☆'.repeat(5 - safeRating)}`;
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

  private extractImageUrl(image: unknown): string {
    if (typeof image === 'string') {
      return image.trim();
    }

    if (image && typeof image === 'object' && 'url' in image) {
      const maybeUrl = (image as { url?: unknown }).url;
      return typeof maybeUrl === 'string' ? maybeUrl.trim() : '';
    }

    return '';
  }

  private toPayload(): ProductPayload {
    return {
      name: String(this.form.value.name || '').trim(),
      description: this.toOptionalString(this.form.value.description),
      price: Number(this.form.value.price || 0),
      stock: Number(this.form.value.stock || 0),
      shopId: this.associatedShop()?._id || String(this.form.value.shopId || '').trim(),
      categoryId: String(this.form.value.categoryId || '').trim(),
      isActive: !!this.form.value.isActive,
    };
  }

  private clearSelectedImageState(): void {
    this.selectedImagePreviewUrls().forEach((url) => URL.revokeObjectURL(url));
    this.selectedImagePreviewUrls.set([]);
    this.selectedImageFiles.set([]);
  }

  private showSuccessMessage(message: string): void {
    this.clearSuccessMessageTimer();
    this.successMessage.set(message);
    this.successMessageTimer = setTimeout(() => {
      this.successMessage.set(null);
      this.successMessageTimer = null;
    }, 5000);
  }

  private clearSuccessMessageTimer(): void {
    if (this.successMessageTimer) {
      clearTimeout(this.successMessageTimer);
      this.successMessageTimer = null;
    }
  }

  private applyShopAssociationState(): void {
    if (this.requiresShopAssociation()) {
      this.form.disable({ emitEvent: false });
      this.form.patchValue({ shopId: '' }, { emitEvent: false });
      return;
    }

    this.form.enable({ emitEvent: false });
    const associatedShopId = this.associatedShop()?._id || '';
    const currentShopId = String(this.form.value.shopId || '').trim();
    if (associatedShopId && currentShopId !== associatedShopId) {
      this.form.patchValue({ shopId: associatedShopId }, { emitEvent: false });
    }
  }

  private toOptionalString(value: unknown): string | undefined {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private loadProductReviews(productId: string): void {
    this.reviewsLoading.set(true);
    this.reviewsError.set(null);
    this.productReviews.set([]);

    this.productsService.getProductReviews(productId).subscribe({
      next: (response) => {
        this.productReviews.set(response?.reviews || []);
        this.reviewsLoading.set(false);
      },
      error: (error) => {
        this.reviewsError.set(error?.error?.message || 'Unable to load product reviews.');
        this.reviewsLoading.set(false);
      },
    });
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

