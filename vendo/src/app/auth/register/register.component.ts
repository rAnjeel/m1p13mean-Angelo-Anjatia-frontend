import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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
      { value: 'client', label: 'Client' },
      { value: 'shopKeeper', label: 'Boutiquier' },
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
      next: (response: any) => {
        this.successMessage.set(response?.message || 'Compte créé avec succès.');
        this.form.reset({ role: 'client' });
        this.loading.set(false);
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
        apiErrors.push('Veuillez vérifier les champs du formulaire et réessayer.');
        break;
      case 409:
        apiErrors.push('Un utilisateur avec cet e-mail existe déjà.');
        break;
      case 0:
        apiErrors.push('Impossible de joindre le serveur. Vérifiez votre connexion.');
        break;
      default:
        apiErrors.push('Une erreur inattendue est survenue. Veuillez réessayer.');
        break;
    }

    return apiErrors;
  }
}
