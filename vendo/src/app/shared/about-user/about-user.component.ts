import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

interface ConnectedUser {
  _id?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface Shop {
  _id: string;
  name: string;
  merchantId: string | { _id?: string; fullName?: string; email?: string };
  description?: string;
  location?: string;
  isOpen: boolean;
}

@Component({
  selector: 'app-about-user',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about-user.component.html',
  styleUrl: './about-user.component.css'
})
export class AboutUserComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authBaseUrl = `${environment.apiUrl}/auth`;
  private readonly shopsBaseUrl = `${environment.apiUrl}/shops`;
  private readonly userStorageKey = 'auth_user';
  private readonly profilePhotoStorageKey = 'profile_photo_data_url';

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly serverSuccess = signal<string | null>(null);
  readonly photoError = signal<string | null>(null);
  readonly user = signal<ConnectedUser | null>(null);
  readonly linkedShop = signal<Shop | null>(null);
  readonly profilePhoto = signal<string | null>(null);
  readonly shops = signal<Shop[]>([]);
  readonly searchTerm = signal('');
  readonly selectedShopId = signal('');
  readonly pickerOpen = signal(false);

  readonly filteredShops = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) {
      return this.shops();
    }
    return this.shops().filter((shop) => {
      const name = (shop.name || '').toLowerCase();
      const location = (shop.location || '').toLowerCase();
      return name.includes(query) || location.includes(query);
    });
  });

  ngOnInit(): void {
    this.profilePhoto.set(this.readStoredProfilePhoto());
    this.loadProfile();
  }

  get isShopkeeper(): boolean {
    return (this.user()?.role || '').toLowerCase() === 'shopkeeper';
  }

  get hasLinkedShop(): boolean {
    return !!this.linkedShop();
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

  onProfilePhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.photoError.set('Please select an image file.');
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.photoError.set('Image must be smaller than 2 MB.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) {
        this.photoError.set('Unable to read selected image.');
        return;
      }
      this.profilePhoto.set(result);
      this.persistProfilePhoto(result);
      this.photoError.set(null);
      this.serverSuccess.set('Profile photo updated.');
    };
    reader.onerror = () => {
      this.photoError.set('Unable to read selected image.');
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeProfilePhoto(): void {
    this.profilePhoto.set(null);
    this.photoError.set(null);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.profilePhotoStorageKey);
    }
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.selectedShopId.set('');
    this.pickerOpen.set(true);
  }

  openPicker(): void {
    this.pickerOpen.set(true);
  }

  closePicker(): void {
    setTimeout(() => this.pickerOpen.set(false), 120);
  }

  pickShop(shop: Shop): void {
    this.selectedShopId.set(shop._id);
    this.searchTerm.set(shop.location ? `${shop.name} - ${shop.location}` : shop.name);
    this.pickerOpen.set(false);
  }

  submitShopAssociation(): void {
    if (!this.isShopkeeper || this.saving()) {
      return;
    }

    const currentUserId = this.user()?._id;
    if (!currentUserId) {
      this.serverError.set('Unable to identify the connected user.');
      return;
    }

    const selectedShopId = this.selectedShopId().trim();
    if (!selectedShopId) {
      this.serverError.set('Please select a shop to associate.');
      return;
    }

    this.saving.set(true);
    this.serverError.set(null);
    this.serverSuccess.set(null);

    const payload = { merchantId: currentUserId };

    this.http.put<{ shop?: Shop; message?: string }>(`${this.shopsBaseUrl}/${selectedShopId}`, payload).subscribe({
      next: (response) => {
        const updatedShop = response?.shop || this.shops().find((shop) => shop._id === selectedShopId) || null;
        this.linkedShop.set(updatedShop);
        this.selectedShopId.set('');
        this.searchTerm.set('');
        this.serverSuccess.set(response?.message || 'Shop linked successfully.');
        this.saving.set(false);
        this.loadShopsData(currentUserId);
      },
      error: (error) => {
        this.serverError.set(this.parseError(error, 'Unable to associate a shop.'));
        this.saving.set(false);
      }
    });
  }

  private loadProfile(): void {
    this.loading.set(true);
    this.serverError.set(null);

    const localUser = this.readStoredUser();
    if (localUser) {
      this.user.set(localUser);
    }

    this.http.get<{ user?: ConnectedUser }>(`${this.authBaseUrl}/me`).subscribe({
      next: (response) => {
        const apiUser = response?.user ?? localUser;
        if (apiUser) {
          this.user.set(apiUser);
          this.persistUser(apiUser);
        }
        this.loadShopkeeperData();
      },
      error: () => {
        this.loadShopkeeperData();
      }
    });
  }

  private loadShopkeeperData(): void {
    if (!this.isShopkeeper) {
      this.loading.set(false);
      return;
    }

    const currentUserId = this.user()?._id;
    if (!currentUserId) {
      this.loading.set(false);
      this.serverError.set('Shopkeeper profile is missing user id.');
      return;
    }

    this.loadShopsData(currentUserId);
  }

  private loadShopsData(currentUserId: string): void {
    this.http.get<{ shops?: Shop[] }>(this.shopsBaseUrl).subscribe({
      next: (response) => {
        const shops = response?.shops || [];
        this.shops.set(shops);
        const match = shops.find((shop) => this.extractMerchantId(shop.merchantId) === currentUserId) || null;
        this.linkedShop.set(match);
        this.loading.set(false);
      },
      error: () => {
        this.serverError.set('Unable to load shop association.');
        this.loading.set(false);
      }
    });
  }

  private extractMerchantId(value: Shop['merchantId']): string {
    return typeof value === 'string' ? value : String(value?._id || '');
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

  private readStoredProfilePhoto(): string | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }
    const value = localStorage.getItem(this.profilePhotoStorageKey);
    return value?.trim() || null;
  }

  private persistUser(user: ConnectedUser): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(this.userStorageKey, JSON.stringify(user));
  }

  private persistProfilePhoto(dataUrl: string): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(this.profilePhotoStorageKey, dataUrl);
  }

  private parseError(error: any, fallback: string): string {
    const messages = Array.isArray(error?.error?.errors) ? error.error.errors : [];
    if (messages.length > 0) {
      return String(messages[0]);
    }
    if (error?.error?.message) {
      return String(error.error.message);
    }
    return fallback;
  }
}



