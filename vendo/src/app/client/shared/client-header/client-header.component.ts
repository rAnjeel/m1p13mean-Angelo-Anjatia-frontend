import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../auth/auth.service';
import { CartService } from '../cart.service';

@Component({
  selector: 'app-client-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './client-header.component.html',
  styleUrl: './client-header.component.css',
})
export class ClientHeaderComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly cartService = inject(CartService);
  private bumpTimer: ReturnType<typeof setTimeout> | null = null;

  @Input() mode: 'home' | 'standard' = 'standard';
  readonly cartAlertVisible = signal(false);
  readonly cartAlertBump = signal(false);

  isMenuOpen = false;
  private readonly cartAlertEffect = effect(() => {
    const tick = this.cartService.cartAlertTick();
    if (!tick) {
      return;
    }

    this.cartAlertVisible.set(true);
    this.cartAlertBump.set(false);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => this.cartAlertBump.set(true));
    } else {
      this.cartAlertBump.set(true);
    }

    if (this.bumpTimer) {
      clearTimeout(this.bumpTimer);
    }
    this.bumpTimer = setTimeout(() => this.cartAlertBump.set(false), 500);
  });

  ngOnDestroy(): void {
    if (this.bumpTimer) {
      clearTimeout(this.bumpTimer);
      this.bumpTimer = null;
    }
  }

  clearCartAlert(): void {
    this.cartAlertVisible.set(false);
    this.cartAlertBump.set(false);
  }

  // Compat with stale template caches that may still call cartAlertActive().
  cartAlertActive(): boolean {
    return this.cartAlertVisible();
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.completeLogout();
      },
      error: () => {
        this.completeLogout();
      },
    });
  }

  private completeLogout(): void {
    this.authService.clearSession();
    this.isMenuOpen = false;
    void this.router.navigateByUrl('/login');
  }
}
