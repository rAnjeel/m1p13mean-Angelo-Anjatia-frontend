import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { Rent, RentShop, RentsService } from './rents.service';

@Component({
  selector: 'app-admin-rents',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './rents.component.html',
  styleUrl: './rents.component.css',
})
export class RentsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly rentsService = inject(RentsService);

  private readonly now = new Date();

  filterForm: FormGroup = this.fb.group({
    month: [this.now.getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]],
    year: [this.now.getFullYear(), [Validators.required, Validators.min(2000)]],
  });

  rents = signal<Rent[]>([]);
  paidRents = signal<Rent[]>([]);
  selectedMonthLabel = signal('');

  loading = signal(false);
  payingId = signal<string | null>(null);
  serverErrors = signal<string[]>([]);
  successMessage = signal<string | null>(null);

  readonly monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  ngOnInit(): void {
    this.loadUnpaidRents();
  }

  get totalUnpaidRents(): number {
    return this.rents().length;
  }

  get totalAmountToCollect(): number {
    return this.rents().reduce((sum, rent) => sum + Number(rent.amount || 0), 0);
  }

  get totalPaidRents(): number {
    return this.paidRents().length;
  }

  get totalPaidAmount(): number {
    return this.paidRents().reduce((sum, rent) => sum + Number(rent.amount || 0), 0);
  }

  get filterMonthValue(): number {
    return Number(this.filterForm.value.month);
  }

  get filterYearValue(): number {
    return Number(this.filterForm.value.year);
  }

  loadUnpaidRents(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      return;
    }

    const month = this.filterMonthValue;
    const year = this.filterYearValue;

    this.loading.set(true);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    forkJoin({
      unpaid: this.rentsService.getUnpaidRents(month, year),
      paid: this.rentsService.getPaidRents(200),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ unpaid, paid }) => {
          this.rents.set(unpaid.rents || []);
          this.paidRents.set(paid.rents || []);
          this.selectedMonthLabel.set(unpaid.month || this.formatMonthKey(month, year));
          if ((unpaid.rents || []).length === 0 && unpaid.message) {
            this.successMessage.set(unpaid.message);
          }
        },
        error: (error) => {
          this.rents.set([]);
          this.paidRents.set([]);
          this.serverErrors.set(this.parseApiErrors(error));
        },
      });
  }

  payRent(rent: Rent): void {
    if (this.payingId()) return;
    if (rent.status === 'paid') return;
    if (!confirm('Mark this rent as paid?')) return;

    this.payingId.set(rent._id);
    this.serverErrors.set([]);
    this.successMessage.set(null);

    this.rentsService
      .payRent(rent._id)
      .pipe(finalize(() => this.payingId.set(null)))
      .subscribe({
        next: () => {
          this.successMessage.set('Rent marked as paid successfully.');
          this.loadUnpaidRents();
        },
        error: (error) => {
          this.serverErrors.set(this.parseApiErrors(error));
        },
      });
  }

  getShopName(rent: Rent): string {
    const shop = rent.shopId as string | RentShop;
    if (typeof shop === 'string') {
      return shop;
    }
    return shop.name || shop._id || 'Unknown shop';
  }

  getShopLocation(rent: Rent): string {
    const shop = rent.shopId as string | RentShop;
    if (typeof shop === 'string') {
      return '-';
    }
    return shop.location || '-';
  }

  formatMonth(monthKey: string): string {
    if (!monthKey || !monthKey.includes('-')) return monthKey;
    const [year, month] = monthKey.split('-').map(Number);
    if (!year || !month) return monthKey;

    const date = new Date(year, month - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  formatDateTime(value: string | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackByRentId(_index: number, rent: Rent): string {
    return rent._id;
  }

  hasError(controlName: string, errorKey?: string): boolean {
    const control = this.filterForm.get(controlName);
    if (!control) return false;
    if (!control.touched && !control.dirty) return false;
    return errorKey ? !!control.errors?.[errorKey] : !!control.errors;
  }

  private formatMonthKey(month: number, year: number): string {
    return `${year}-${String(month).padStart(2, '0')}`;
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
        apiErrors.push('Please select a valid month and year.');
        break;
      case 401:
      case 403:
        apiErrors.push('You are not allowed to access rent management.');
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
