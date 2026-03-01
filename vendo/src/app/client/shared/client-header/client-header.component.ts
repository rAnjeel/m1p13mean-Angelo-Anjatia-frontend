import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../auth/auth.service';

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

  @Input() cartCount = 0;
  @Input() mode: 'home' | 'standard' = 'standard';

  isMenuOpen = false;

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
