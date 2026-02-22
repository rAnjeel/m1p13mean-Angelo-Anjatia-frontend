import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section style="min-height: 60vh; display: grid; place-items: center; padding: 24px;">
      <div style="max-width: 520px; text-align: center;">
        <h1 style="margin: 0 0 8px; font-size: 2rem;">Access Denied</h1>
        <p style="margin: 0 0 16px;">
          You do not have permission to access this page.
        </p>
        <a
          routerLink="/login"
          style="display: inline-block; padding: 10px 14px; border-radius: 8px; text-decoration: none; border: 1px solid currentColor;"
        >
          Back to login
        </a>
      </div>
    </section>
  `,
})
export class UnauthorizedComponent {}
