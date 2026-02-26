import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import {
  Shop,
  ShopCategory,
  ShopMerchant,
  ShopPayload,
  ShopsService,
  UserOption,
} from './shops.service';

@Component({
  selector: 'app-admin-shops',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './shops.component.html',
  styleUrl: './shops.component.css',
})
export class ShopsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly shopsService = inject(ShopsService);
  private readonly router = inject(Router);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.maxLength(500)]],
    merchantId: ['', [Validators.required]],
    categoryId: ['', [Validators.required]],
    location: ['', [Validators.maxLength(120)]],
    isOpen: [true, [Validators.required]],
  });

  shops = signal<Shop[]>([]);
  merchantOptions = signal<UserOption[]>([]);
  categoryOptions = signal<ShopCategory[]>([]);

  loadingData = signal(false);
  saving = signal(false);
  deletingId = signal<string | null>(null);
  selectedShopId = signal<string | null>(null);

  serverErrors = signal<string[]>([]);
  successMessage = signal<string | null>(null);

  searchTerm = signal('');
  statusFilter = signal<'all' | 'open' | 'closed'>('all');

  ngOnInit(): void {
    this.loadInitialData();
  }

  get filteredShops(): Shop[] {
    const search = this.searchTerm().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.shops().filter((shop) => {
      if (filter === 'open' && !shop.isOpen) return false;
      if (filter === 'closed' && shop.isOpen) return false;
      if (!search) return true;

      const merchant = this.getMerchantName(shop).toLowerCase();
      const category = this.getCategoryName(shop).toLowerCase();

      return (
        shop.name.toLowerCase().includes(search) ||
        (shop.location || '').toLowerCase().includes(search) ||
        merchant.includes(search) ||
        category.includes(search)
      );
    });
  }

  get totalShops(): number {
    return this.shops().length;
  }

  get openShops(): number {
    return this.shops().filter((shop) => shop.isOpen).length;
  }

  get closedShops(): number {
    return this.shops().filter((shop) => !shop.isOpen).length;
  }

  get isEditMode(): boolean {
    return !!this.selectedShopId();
  }

  loadInitialData(): void {
    this.loadingData.set(true);
    this.serverErrors.set([]);

    forkJoin({
      shopsResponse: this.shopsService.getShops(),
      usersResponse: this.shopsService.getUsers(),
      categoriesResponse: this.shopsService.getShopCategories(),
    })
      .pipe(finalize(() => this.loadingData.set(false)))
      .subscribe({
        next: ({ shopsResponse, usersResponse, categoriesResponse }) => {
          this.shops.set(shopsResponse.shops || []);
          this.categoryOptions.set(categoriesResponse.categories || []);
          this.merchantOptions.set(
            (usersResponse.users || []).filter((user) =>
              (user.role || '').toLowerCase().includes('shop')
            )
          );
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
    const selectedId = this.selectedShopId();
    const request$ = selectedId
      ? this.shopsService.updateShop(selectedId, payload)
      : this.shopsService.createShop(payload);

    this.saving.set(true);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.successMessage.set(
          selectedId ? 'Shop updated successfully.' : 'Shop created successfully.'
        );
        this.resetForm();
        this.loadInitialData();
      },
      error: (error) => {
        this.serverErrors.set(this.parseApiErrors(error));
      },
    });
  }

  editShop(shop: Shop): void {
    this.selectedShopId.set(shop._id);
    this.successMessage.set(null);
    this.serverErrors.set([]);

    this.form.patchValue({
      name: shop.name || '',
      description: shop.description || '',
      merchantId: this.extractMerchantId(shop),
      categoryId: this.extractCategoryId(shop),
      location: shop.location || '',
      isOpen: !!shop.isOpen,
    });
    this.form.markAsPristine();
  }

  onShopImagesSelected(shopId: string, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = input?.files;
    if (!files || files.length === 0) {
      return;
    }

    const fileArray = Array.from(files);
    this.saving.set(true);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    this.shopsService
      .addShopImages(shopId, fileArray)
      .pipe(
        finalize(() => {
          this.saving.set(false);
          if (input) {
            input.value = '';
          }
        })
      )
      .subscribe({
        next: () => {
          this.successMessage.set('Shop images uploaded successfully.');
          this.loadInitialData();
        },
        error: (error) => {
          this.serverErrors.set(this.parseApiErrors(error));
        },
      });
  }

  deleteShop(shopId: string): void {
    if (this.deletingId()) return;
    if (!confirm('Delete this shop permanently?')) return;

    this.deletingId.set(shopId);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    this.shopsService
      .deleteShop(shopId)
      .pipe(finalize(() => this.deletingId.set(null)))
      .subscribe({
        next: () => {
          this.successMessage.set('Shop deleted successfully.');
          if (this.selectedShopId() === shopId) {
            this.resetForm();
          }
          this.loadInitialData();
        },
        error: (error) => {
          this.serverErrors.set(this.parseApiErrors(error));
        },
      });
  }

  resetForm(): void {
    this.selectedShopId.set(null);
    this.form.reset({
      name: '',
      description: '',
      merchantId: '',
      categoryId: '',
      location: '',
      isOpen: true,
    });
    this.form.markAsPristine();
  }

  setStatusFilter(value: 'all' | 'open' | 'closed'): void {
    this.statusFilter.set(value);
  }

  updateSearch(value: string): void {
    this.searchTerm.set(value || '');
  }

  onCategorySelectionChange(value: string): void {
    if (value !== '__add_category__') return;
    this.form.patchValue({ categoryId: '' });
    void this.router.navigateByUrl('/admin/categories');
  }

  hasError(controlName: string, errorKey?: string): boolean {
    const control = this.form.get(controlName);
    if (!control) return false;
    if (!control.touched && !control.dirty) return false;
    return errorKey ? !!control.errors?.[errorKey] : !!control.errors;
  }

  getMerchantName(shop: Shop): string {
    const merchant = shop.merchantId;
    if (typeof merchant === 'string') {
      const match = this.merchantOptions().find((user) => user._id === merchant);
      return match?.fullName || merchant;
    }
    return merchant.fullName || merchant.email || 'Unknown';
  }

  getCategoryName(shop: Shop): string {
    const category = shop.categoryId;
    if (typeof category === 'string') {
      const match = this.categoryOptions().find((item) => item._id === category);
      return match?.name || category;
    }
    return category.name || 'Unknown';
  }

  shopStatusLabel(shop: Shop): string {
    return shop.isOpen ? 'Open' : 'Closed';
  }

  getShopImageUrl(shop: Shop): string | null {
    const images = Array.isArray(shop.images) ? shop.images : [];
    if (!images.length) {
      return null;
    }
    const primary = images.find((image) => image?.isPrimary) ?? images[0];
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

  trackByShopId(_index: number, shop: Shop): string {
    return shop._id;
  }

  private toPayload(): ShopPayload {
    return {
      name: String(this.form.value.name || '').trim(),
      description: this.toOptionalString(this.form.value.description),
      merchantId: String(this.form.value.merchantId || '').trim(),
      categoryId: String(this.form.value.categoryId || '').trim(),
      location: this.toOptionalString(this.form.value.location),
      isOpen: !!this.form.value.isOpen,
    };
  }

  private toOptionalString(value: unknown): string | undefined {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private extractMerchantId(shop: Shop): string {
    const merchant = shop.merchantId as string | ShopMerchant;
    return typeof merchant === 'string' ? merchant : merchant._id;
  }

  private extractCategoryId(shop: Shop): string {
    const category = shop.categoryId as string | ShopCategory;
    return typeof category === 'string' ? category : category._id;
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
        apiErrors.push('Related merchant or category was not found.');
        break;
      case 409:
        apiErrors.push('This shop conflicts with existing data.');
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
