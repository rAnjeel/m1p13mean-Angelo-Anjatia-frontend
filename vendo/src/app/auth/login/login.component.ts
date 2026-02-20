import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  loading = signal(false);
  serverErrors = signal<string[]>([]);
  successMessage = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    this.authService.login(this.form.value).subscribe({
      next: (response) => {
        const token = response?.token ?? response?.accessToken;
        if (token && response?.user) {
          this.authService.setSession(token, response.user);
        }

        this.successMessage.set(response?.message || 'Logged in successfully.');
        this.loading.set(false);
        const role = String((response as any)?.user?.role || '').toLowerCase();
        const targetRoute = role === 'shopkeeper' ? '/shopkeeper/products' : '/admin/dashboard';
        void this.router.navigateByUrl(targetRoute);
      },
      error: (error) => {
        this.serverErrors.set(this.parseApiErrors(error));
        this.loading.set(false);
      },
    });
  }

  hasError(controlName: string, errorKey?: string): boolean {
    const control = this.form.get(controlName);
    if (!control) return false;
    if (!control.touched && !control.dirty) return false;
    return errorKey ? !!control.errors?.[errorKey] : !!control.errors;
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
        apiErrors.push('Please provide both email and password.');
        break;
      case 401:
        apiErrors.push('Invalid email or password.');
        break;
      case 403:
        apiErrors.push('This account is disabled.');
        break;
      case 404:
        apiErrors.push('No account found with this email. Please register first.');
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
