import { Component, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIf, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly title = signal('vendo');
  protected readonly showLayout = signal(true);
  protected readonly isLoggingOut = signal(false);

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const path = (event as NavigationEnd).urlAfterRedirects ?? '';
        const isAuthRoute = path.startsWith('/login') || path.startsWith('/register');
        this.showLayout.set(!isAuthRoute);
      });
  }

  logout(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
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
    this.isLoggingOut.set(false);
    void this.router.navigateByUrl('/login');
  }
}
