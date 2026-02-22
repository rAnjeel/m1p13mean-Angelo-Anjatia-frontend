import { Component, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';

interface MenuItem {
  label: string;
  href: string;
  submenu?: MenuItem[];
}

interface MenuState {
  mainMenuOpen: boolean;
  activeDropdown: string | null;
}

const ROLE_PAGES: Record<string, string[]> = {
  client: ['/admin/categories'],
  shopkeeper: ['/shopkeeper/products', '/admin/categories'],
  admin: ['/admin/dashboard', '/admin/shops', '/admin/categories', '/admin/users']
};

const ROUTE_LABELS: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/shops': 'Shops',
  '/admin/categories': 'Categories',
  '/admin/users': 'Users',
  '/shopkeeper/products': 'Products'
};

const getStoredRole = (): string | null => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  const rawUser = localStorage.getItem('auth_user');
  if (!rawUser) {
    return null;
  }

  try {
    const user = JSON.parse(rawUser) as { role?: string };
    return typeof user.role === 'string' ? user.role.trim().toLowerCase() : null;
  } catch {
    return null;
  }
};

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIf, NgFor, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly title = signal('vendo');
  protected readonly showLayout = signal(true);
  protected readonly isLoggingOut = signal(false);

  navigationItems: MenuItem[] = [];

  currentMenuState: MenuState = {
    mainMenuOpen: false,
    activeDropdown: null
  };

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const path = (event as NavigationEnd).urlAfterRedirects ?? '';
        const isAuthRoute = path.startsWith('/login') || path.startsWith('/register');
        this.showLayout.set(!isAuthRoute);
        this.refreshNavigation();
      });

    this.refreshNavigation();
  }

  private refreshNavigation(): void {
    const currentRole = getStoredRole();
    const allowedRoutes = currentRole ? ROLE_PAGES[currentRole] ?? [] : [];

    if (!currentRole || allowedRoutes.length === 0) {
      this.navigationItems = [];
      return;
    }

    const items = allowedRoutes
      .map((route) => ({
        label: ROUTE_LABELS[route] ?? route,
        href: route
      }))
      .filter((item) => item.label);

    if (currentRole === 'admin') {
      const dashboardItem = items.find((item) => item.href === '/admin/dashboard');
      const manageItems = items.filter((item) => item.href !== '/admin/dashboard');
      this.navigationItems = [
        ...(dashboardItem ? [dashboardItem] : []),
        ...(manageItems.length > 0
          ? [
              {
                label: 'Manage',
                href: manageItems[0].href,
                submenu: manageItems
              }
            ]
          : [])
      ];
      return;
    }

    this.navigationItems = items;
  }

  toggleMainMenu(): void {
    this.currentMenuState = {
      ...this.currentMenuState,
      mainMenuOpen: !this.currentMenuState.mainMenuOpen
    };
  }

  toggleDropdown(itemLabel: string): void {
    this.currentMenuState = {
      ...this.currentMenuState,
      activeDropdown: this.currentMenuState.activeDropdown === itemLabel ? null : itemLabel
    };
  }

  closeMenu(): void {
    this.currentMenuState = {
      mainMenuOpen: false,
      activeDropdown: null
    };
  }

  isDropdownOpen(itemLabel: string): boolean {
    return this.currentMenuState.activeDropdown === itemLabel;
  }

  hasSubmenu(item: MenuItem): boolean {
    return item.submenu !== undefined && item.submenu.length > 0;
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
