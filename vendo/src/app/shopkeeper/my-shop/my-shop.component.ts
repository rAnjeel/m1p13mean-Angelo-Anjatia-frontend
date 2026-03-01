import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { MyShopService, Shop, ShopCategory, ShopPayload } from './my-shop.service';

@Component({
  selector: 'app-shopkeeper-my-shop',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './my-shop.component.html',
  styleUrl: './my-shop.component.css',
})
export class MyShopComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly myShopService = inject(MyShopService);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.maxLength(500)]],
    categoryId: ['', [Validators.required]],
    location: ['', [Validators.maxLength(120)]],
    isOpen: [true, [Validators.required]],
  });

  myShop = signal<Shop | null>(null);
  categoryOptions = signal<ShopCategory[]>([]);
  selectedImages = signal<File[]>([]);
  popupImageUrl = signal<string | null>(null);

  loadingData = signal(false);
  saving = signal(false);
  serverErrors = signal<string[]>([]);
  successMessage = signal<string | null>(null);
  noShopMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadMyShop();
  }

  loadMyShop(): void {
    this.loadingData.set(true);
    this.serverErrors.set([]);
    this.successMessage.set(null);
    this.noShopMessage.set(null);

    forkJoin({
      shopsResponse: this.myShopService.getShops(),
      categoriesResponse: this.myShopService.getShopCategories(),
    })
      .pipe(finalize(() => this.loadingData.set(false)))
      .subscribe({
        next: ({ shopsResponse, categoriesResponse }) => {
          const currentUserId = this.extractLoggedUserId();
          const shops = shopsResponse.shops || [];
          const currentShop = this.findShopForUser(shops, currentUserId);

          this.categoryOptions.set(categoriesResponse.categories || []);

          if (!currentShop) {
            this.myShop.set(null);
            this.noShopMessage.set('No shop is associated with your account.');
            return;
          }

          this.myShop.set(currentShop);
          this.patchForm(currentShop);
        },
        error: (error) => {
          this.serverErrors.set(this.parseApiErrors(error));
        },
      });
  }

  onSubmit(): void {
    const shop = this.myShop();
    if (!shop) {
      this.noShopMessage.set('No shop is associated with your account.');
      return;
    }

    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.toPayload();
    const files = this.selectedImages();

    this.saving.set(true);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    this.myShopService
      .updateShop(shop._id, payload)
      .pipe(
        switchMap((response) => {
          if (files.length === 0) {
            return of(response);
          }
          return this.myShopService.uploadShopImages(shop._id, files, true).pipe(map(() => response));
        }),
        finalize(() => this.saving.set(false))
      )
      .subscribe({
        next: () => {
          this.successMessage.set('My shop updated successfully.');
          this.selectedImages.set([]);
          this.loadMyShop();
        },
        error: (error) => {
          this.serverErrors.set(this.parseApiErrors(error));
        },
      });
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/')).slice(0, 5);
    this.selectedImages.set(imageFiles);
  }

  clearSelectedImages(): void {
    this.selectedImages.set([]);
  }

  hasError(controlName: string, errorKey?: string): boolean {
    const control = this.form.get(controlName);
    if (!control) return false;
    if (!control.touched && !control.dirty) return false;
    return errorKey ? !!control.errors?.[errorKey] : !!control.errors;
  }

  get selectedImageNames(): string[] {
    return this.selectedImages().map((file) => file.name);
  }

  getShopPrimaryImage(shop: Shop): string | null {
    const images = Array.isArray(shop.images) ? shop.images : [];
    if (!images.length) return null;
    const primary = images.find((image) => !!image?.isPrimary) || images[0];
    return primary?.url || null;
  }

  getShopInitials(name: string | undefined): string {
    const value = String(name || '').trim();
    if (!value) return '?';
    const parts = value.split(/\s+/);
    if (parts.length === 1) return value.slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }

  getShopkeeperName(shop: Shop): string {
    const merchant = shop.merchantId;
    if (typeof merchant === 'string') {
      return merchant;
    }
    return merchant?.fullName || merchant?.email || merchant?._id || 'Unknown shopkeeper';
  }

  openImagePopup(imageUrl: string | null): void {
    if (!imageUrl) return;
    this.popupImageUrl.set(imageUrl);
  }

  closeImagePopup(): void {
    this.popupImageUrl.set(null);
  }

  private patchForm(shop: Shop): void {
    this.form.patchValue({
      name: shop.name || '',
      description: shop.description || '',
      categoryId: this.extractCategoryId(shop),
      location: shop.location || '',
      isOpen: !!shop.isOpen,
    });
    this.form.markAsPristine();
  }

  private toPayload(): ShopPayload {
    return {
      name: String(this.form.value.name || '').trim(),
      description: this.toOptionalString(this.form.value.description),
      categoryId: String(this.form.value.categoryId || '').trim(),
      location: this.toOptionalString(this.form.value.location),
      isOpen: !!this.form.value.isOpen,
    };
  }

  private toOptionalString(value: unknown): string | undefined {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private findShopForUser(shops: Shop[], userId: string | null): Shop | null {
    if (!userId) return null;

    const found = shops.find((shop) => {
      const merchant = shop.merchantId;
      if (typeof merchant === 'string') return merchant === userId;
      return merchant?._id === userId;
    });

    return found || null;
  }

  private extractCategoryId(shop: Shop): string {
    const category = shop.categoryId;
    return typeof category === 'string' ? category : category?._id || '';
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
        apiErrors.push('Shop or category not found.');
        break;
      case 403:
        apiErrors.push('You are not allowed to update this shop.');
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
