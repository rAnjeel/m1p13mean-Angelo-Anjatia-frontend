import { Component, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIf],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('vendo');
  protected readonly showLayout = signal(true);

  constructor(router: Router) {
    router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const path = (event as NavigationEnd).urlAfterRedirects ?? '';
        const isAuthRoute = path.startsWith('/login') || path.startsWith('/register');
        this.showLayout.set(!isAuthRoute);
      });
  }
}
