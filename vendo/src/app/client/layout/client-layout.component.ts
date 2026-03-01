import { Component, OnDestroy, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ClientHeaderComponent } from '../shared/client-header/client-header.component';
import { ClientFooterComponent } from '../shared/client-footer/client-footer.component';

@Component({
  selector: 'app-client-layout',
  standalone: true,
  imports: [RouterOutlet, ClientHeaderComponent, ClientFooterComponent],
  templateUrl: './client-layout.component.html',
})
export class ClientLayoutComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly routerSub: Subscription;

  protected readonly mode = signal<'home' | 'standard'>('standard');

  constructor() {
    this.updateMode(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateMode((event as NavigationEnd).urlAfterRedirects ?? '');
      });
  }

  ngOnDestroy(): void {
    this.routerSub.unsubscribe();
  }

  private updateMode(url: string): void {
    this.mode.set('standard');
  }
}
