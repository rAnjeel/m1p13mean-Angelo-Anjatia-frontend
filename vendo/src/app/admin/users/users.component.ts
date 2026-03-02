import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { User, UserCreatePayload, UserUpdatePayload, UsersService } from './users.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);

  form: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['client', [Validators.required]],
    phone: ['', [Validators.pattern(/^\+?[\d\s\-().]{7,15}$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    isActive: [true, [Validators.required]],
  });

  users = signal<User[]>([]);
  loading = signal(false);
  saving = signal(false);
  deletingId = signal<string | null>(null);
  selectedUserId = signal<string | null>(null);
  serverErrors = signal<string[]>([]);
  successMessage = signal<string | null>(null);
  passwordVisible = signal(false);
  searchTerm = signal('');
  statusFilter = signal<'all' | 'active' | 'inactive'>('all');

  ngOnInit(): void {
    this.loadUsers();
  }

  get isEditMode(): boolean {
    return !!this.selectedUserId();
  }

  get filteredUsers(): User[] {
    const search = this.searchTerm().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.users().filter((user) => {
      const isActive = user.isActive !== false;
      if (filter === 'active' && !isActive) return false;
      if (filter === 'inactive' && isActive) return false;
      if (!search) return true;

      return (
        (user.fullName || '').toLowerCase().includes(search) ||
        (user.email || '').toLowerCase().includes(search) ||
        (user.role || '').toLowerCase().includes(search) ||
        (user.phone || '').toLowerCase().includes(search)
      );
    });
  }

  get totalUsers(): number {
    return this.users().length;
  }

  get activeUsers(): number {
    return this.users().filter((user) => user.isActive !== false).length;
  }

  get inactiveUsers(): number {
    return this.users().filter((user) => user.isActive === false).length;
  }

  loadUsers(): void {
    this.loading.set(true);
    this.serverErrors.set([]);

    this.usersService
      .getUsers()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.users.set(response.users || []);
        },
        error: (error) => {
          this.serverErrors.set(this.parseApiErrors(error));
        },
      });
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const selectedId = this.selectedUserId();
    const request$ = selectedId
      ? this.usersService.updateUser(selectedId, this.toUpdatePayload())
      : this.usersService.createUser(this.toCreatePayload());

    this.saving.set(true);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.successMessage.set(
          selectedId ? 'User updated successfully.' : 'User created successfully.'
        );
        this.resetForm();
        this.loadUsers();
      },
      error: (error) => {
        this.serverErrors.set(this.parseApiErrors(error));
      },
    });
  }

  editUser(user: User): void {
    this.selectedUserId.set(user._id);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    this.form.patchValue({
      fullName: user.fullName || '',
      email: user.email || '',
      role: (user.role || 'client').toLowerCase(),
      phone: user.phone || '',
      password: '',
      isActive: user.isActive !== false,
    });
    this.setPasswordValidation(false);
    this.passwordVisible.set(false);
    this.form.markAsPristine();
  }

  deleteUser(userId: string): void {
    if (this.deletingId()) return;
    if (!confirm('Delete this user permanently?')) return;

    this.deletingId.set(userId);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    this.usersService
      .deleteUser(userId)
      .pipe(finalize(() => this.deletingId.set(null)))
      .subscribe({
        next: () => {
          this.successMessage.set('User deleted successfully.');
          if (this.selectedUserId() === userId) {
            this.resetForm();
          }
          this.loadUsers();
        },
        error: (error) => {
          this.serverErrors.set(this.parseApiErrors(error));
        },
      });
  }

  resetForm(): void {
    this.selectedUserId.set(null);
    this.form.reset({
      fullName: '',
      email: '',
      role: 'client',
      phone: '',
      password: '',
      isActive: true,
    });
    this.setPasswordValidation(true);
    this.passwordVisible.set(false);
    this.form.markAsPristine();
  }

  setStatusFilter(value: 'all' | 'active' | 'inactive'): void {
    this.statusFilter.set(value);
  }

  updateSearch(value: string): void {
    this.searchTerm.set(value || '');
  }

  userStatusLabel(user: User): string {
    return user.isActive === false ? 'Inactive' : 'Active';
  }

  trackByUserId(_index: number, user: User): string {
    return user._id;
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((current) => !current);
  }

  hasError(controlName: string, errorKey?: string): boolean {
    const control = this.form.get(controlName);
    if (!control) return false;
    if (!control.touched && !control.dirty) return false;
    return errorKey ? !!control.errors?.[errorKey] : !!control.errors;
  }

  private toCreatePayload(): UserCreatePayload {
    return {
      fullName: String(this.form.value.fullName || '').trim(),
      email: String(this.form.value.email || '').trim().toLowerCase(),
      role: String(this.form.value.role || '').trim().toLowerCase(),
      password: String(this.form.value.password || '').trim(),
      phone: this.toOptionalString(this.form.value.phone),
      isActive: !!this.form.value.isActive,
    };
  }

  private toUpdatePayload(): UserUpdatePayload {
    const payload: UserUpdatePayload = {
      fullName: String(this.form.value.fullName || '').trim(),
      email: String(this.form.value.email || '').trim().toLowerCase(),
      role: String(this.form.value.role || '').trim().toLowerCase(),
      phone: this.toOptionalString(this.form.value.phone),
      isActive: !!this.form.value.isActive,
    };

    const password = String(this.form.value.password || '').trim();
    if (password) {
      payload.password = password;
    }

    return payload;
  }

  private toOptionalString(value: unknown): string | undefined {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private setPasswordValidation(required: boolean): void {
    const control = this.form.get('password');
    if (!control) return;

    if (required) {
      control.setValidators([Validators.required, Validators.minLength(8)]);
    } else {
      control.setValidators([Validators.minLength(8), this.optionalMinLength(8)]);
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private optionalMinLength(minLength: number) {
    return (control: AbstractControl) => {
      const value = String(control.value || '').trim();
      if (value.length === 0) return null;
      return value.length >= minLength
        ? null
        : { minlength: { requiredLength: minLength, actualLength: value.length } };
    };
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
        apiErrors.push('Please check the form fields and try again.');
        break;
      case 404:
        apiErrors.push('User not found.');
        break;
      case 409:
        apiErrors.push('A user with this email already exists.');
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
