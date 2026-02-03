import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  form: FormGroup = this.fb.group({
    role: ['client', Validators.required],
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  loading = signal(false);
  serverErrors = signal<string[]>([]);
  successMessage = signal<string | null>(null);

  get roleOptions() {
    return [
      { value: 'client', label: 'Customer' },
      { value: 'shopKeeper', label: 'ShopKeeper' },
    ];
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    this.authService.register(this.form.value).subscribe({
      next: () => {
        this.successMessage.set('Account created successfully.');
        this.form.reset({ role: 'client' });
        this.loading.set(false);
      },
      error: (error) => {
        const apiErrors: string[] = [];

        if (error?.error?.errors && Array.isArray(error.error.errors)) {
          apiErrors.push(...error.error.errors);
        } else if (error?.error?.message) {
          apiErrors.push(error.error.message);
        } else {
          apiErrors.push('An unexpected error occurred. Please try again.');
        }

        this.serverErrors.set(apiErrors);
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
}

