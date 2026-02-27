import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ClientStat {
  label: string;
  value: string;
}

interface ClientOrder {
  id: string;
  status: string;
  date: string;
  total: string;
}

interface ClientPreference {
  label: string;
  value: string;
}

interface ConnectedUser {
  _id?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
}

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ClientProfileComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authBaseUrl = 'http://localhost:3000/api/auth';
  private readonly userStorageKey = 'auth_user';
  private readonly profilePhotoStorageKey = 'profile_photo_data_url';

  readonly loading = signal(true);
  readonly serverError = signal<string | null>(null);
  readonly user = signal<ConnectedUser | null>(null);
  readonly profilePhoto = signal<string | null>(null);

  readonly stats: ClientStat[] = [
    { label: 'Commandes', value: '28' },
    { label: 'Favoris', value: '14' },
    { label: 'Points fid\u00e9lit\u00e9', value: '1 240' },
    { label: 'Coupons actifs', value: '3' },
  ];

  readonly recentOrders: ClientOrder[] = [
    { id: 'CMD-1482', status: 'Livr\u00e9e', date: '20 f\u00e9vr. 2026', total: '179 EUR' },
    { id: 'CMD-1467', status: 'En pr\u00e9paration', date: '16 f\u00e9vr. 2026', total: '69 EUR' },
    { id: 'CMD-1451', status: 'Retir\u00e9e', date: '11 f\u00e9vr. 2026', total: '115 EUR' },
  ];

  readonly preferences: ClientPreference[] = [
    { label: 'Cat\u00e9gorie favorite', value: 'Mode premium' },
    { label: 'Boutique favorite', value: 'Maison Etoile' },
    { label: 'Canal promo', value: 'Email + notifications' },
    { label: 'Paiement pr\u00e9f\u00e9r\u00e9', value: 'Carte Visa **** 1042' },
  ];

  ngOnInit(): void {
    this.profilePhoto.set(this.readStoredProfilePhoto());
    this.loadProfile();
  }

  get displayName(): string {
    return this.user()?.fullName?.trim() || 'Utilisateur';
  }

  get displayEmail(): string {
    return this.user()?.email?.trim() || 'Email non renseign\u00e9';
  }

  get displayPhone(): string {
    return this.user()?.phone?.trim() || 'T\u00e9l\u00e9phone non renseign\u00e9';
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
        this.loading.set(false);
      },
      error: () => {
        if (!localUser) {
          this.serverError.set('Impossible de charger le profil utilisateur.');
        }
        this.loading.set(false);
      }
    });
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
