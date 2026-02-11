import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CategoriesService, Category, CategoryType } from './categories.service';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.css',
})
export class CategoriesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly categoriesService = inject(CategoriesService);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    type: ['shop', [Validators.required]],
  });

  categories = signal<Category[]>([]);
  loading = signal(false);
  saving = signal(false);
  deletingId = signal<string | null>(null);
  selectedCategoryId = signal<string | null>(null);
  serverErrors = signal<string[]>([]);
  successMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCategories();
  }

  get isEditMode(): boolean {
    return !!this.selectedCategoryId();
  }

  get shopCategoriesCount(): number {
    return this.categories().filter((item) => item.type === 'shop').length;
  }

  get productCategoriesCount(): number {
    return this.categories().filter((item) => item.type === 'product').length;
  }

  loadCategories(): void {
    this.loading.set(true);
    this.serverErrors.set([]);

    this.categoriesService
      .getCategories()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.categories.set(response.categories || []);
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

    const payload = {
      name: String(this.form.value.name || '').trim(),
      type: this.form.value.type as CategoryType,
    };

    const selectedId = this.selectedCategoryId();
    const request$ = selectedId
      ? this.categoriesService.updateCategory(selectedId, payload)
      : this.categoriesService.createCategory(payload);

    this.saving.set(true);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.successMessage.set(
          selectedId ? 'Category updated successfully.' : 'Category created successfully.'
        );
        this.resetForm();
        this.loadCategories();
      },
      error: (error) => {
        this.serverErrors.set(this.parseApiErrors(error));
      },
    });
  }

  editCategory(category: Category): void {
    this.selectedCategoryId.set(category._id);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    this.form.patchValue({
      name: category.name,
      type: category.type,
    });
    this.form.markAsPristine();
  }

  deleteCategory(categoryId: string): void {
    if (this.deletingId()) return;
    if (!confirm('Delete this category permanently?')) return;

    this.deletingId.set(categoryId);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    this.categoriesService
      .deleteCategory(categoryId)
      .pipe(finalize(() => this.deletingId.set(null)))
      .subscribe({
        next: () => {
          this.successMessage.set('Category deleted successfully.');
          if (this.selectedCategoryId() === categoryId) {
            this.resetForm();
          }
          this.loadCategories();
        },
        error: (error) => {
          this.serverErrors.set(this.parseApiErrors(error));
        },
      });
  }

  resetForm(): void {
    this.selectedCategoryId.set(null);
    this.form.reset({
      name: '',
      type: 'shop',
    });
    this.form.markAsPristine();
  }

  hasError(controlName: string, errorKey?: string): boolean {
    const control = this.form.get(controlName);
    if (!control) return false;
    if (!control.touched && !control.dirty) return false;
    return errorKey ? !!control.errors?.[errorKey] : !!control.errors;
  }

  trackByCategoryId(_index: number, category: Category): string {
    return category._id;
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
        apiErrors.push('Category not found.');
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
