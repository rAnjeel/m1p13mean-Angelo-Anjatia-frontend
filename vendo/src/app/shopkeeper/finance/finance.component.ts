import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  ShopkeeperFinancialOrder,
  ShopkeeperFinanceService,
  ShopkeeperTopProduct,
} from './finance.service';

@Component({
  selector: 'app-shopkeeper-finance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './finance.component.html',
  styleUrls: ['./finance.component.css'],
})
export class ShopkeeperFinanceComponent implements OnInit {
  private readonly financeService = inject(ShopkeeperFinanceService);

  readonly loading = signal(true);
  readonly serverError = signal<string | null>(null);

  readonly shopNames = signal<string[]>([]);
  readonly totalSales = signal(0);
  readonly orders = signal<ShopkeeperFinancialOrder[]>([]);
  readonly topProducts = signal<ShopkeeperTopProduct[]>([]);

  readonly totalOrders = computed(() => this.orders().length);
  readonly totalItemsSold = computed(() =>
    this.orders().reduce((sum, order) => sum + Number(order?.itemCount || 0), 0)
  );

  ngOnInit(): void {
    this.loadSummary();
  }

  formatAmount(amount: number): string {
    return Number(amount || 0).toLocaleString('en-US');
  }

  formatDate(value?: string): string {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getStatusLabel(status?: string): string {
    const key = String(status || '').toLowerCase();
    if (key === 'paid') return 'Paid';
    if (key === 'pending') return 'Pending';
    if (key === 'cancelled') return 'Cancelled';
    return status || 'Unknown';
  }

  exportFinancePdf(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const orderRows = this.orders()
      .map(
        (order) => `
          <tr>
            <td>#${this.escapeHtml(order.orderId)}</td>
            <td>${this.escapeHtml(order.clientName || 'Unknown client')}</td>
            <td>${this.escapeHtml(this.formatDate(order.createdAt))}</td>
            <td>${this.escapeHtml(this.getStatusLabel(order.status))}</td>
            <td>${Number(order.itemCount || 0)}</td>
            <td>Ar ${this.escapeHtml(this.formatAmount(order.totalAmount))}</td>
          </tr>
        `
      )
      .join('');

    const topRows = this.topProducts()
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${this.escapeHtml(item.productName)}</td>
            <td>${Number(item.quantitySold || 0)}</td>
            <td>Ar ${this.escapeHtml(this.formatAmount(item.revenue))}</td>
          </tr>
        `
      )
      .join('');

    const popup = window.open('', '_blank', 'width=980,height=760');
    if (!popup) {
      this.serverError.set('Unable to open print window.');
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Financial overview</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; padding: 22px; }
            h1 { margin: 0 0 4px; }
            .muted { color: #4b5563; margin: 0 0 14px; }
            .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
            .kpi { border: 1px solid #d8dbe4; border-radius: 8px; padding: 10px; }
            .kpi .label { font-size: 11px; text-transform: uppercase; color: #6b7280; }
            .kpi .value { font-size: 20px; font-weight: 700; margin-top: 6px; }
            h2 { margin: 14px 0 8px; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            th, td { border: 1px solid #e5e7eb; text-align: left; padding: 8px; font-size: 13px; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Financial overview</h1>
          <p class="muted">Export time: ${this.escapeHtml(new Date().toLocaleString('en-US'))}</p>
          <p class="muted">Shop: ${this.escapeHtml(this.shopNames().join(', ') || 'Unknown')}</p>

          <section class="kpis">
            <div class="kpi">
              <div class="label">Total Sales</div>
              <div class="value">Ar ${this.escapeHtml(this.formatAmount(this.totalSales()))}</div>
            </div>
            <div class="kpi">
              <div class="label">Orders Completed</div>
              <div class="value">${this.totalOrders()}</div>
            </div>
            <div class="kpi">
              <div class="label">Items Sold</div>
              <div class="value">${this.totalItemsSold()}</div>
            </div>
          </section>

          <h2>Orders List</h2>
          <table>
            <thead>
              <tr><th>Order</th><th>Client</th><th>Date</th><th>Status</th><th>Items</th><th>Total</th></tr>
            </thead>
            <tbody>${orderRows || '<tr><td colspan="6">No order recorded.</td></tr>'}</tbody>
          </table>

          <h2>Top 3 Best-Selling Products</h2>
          <table>
            <thead>
              <tr><th>Rank</th><th>Product</th><th>Sold</th><th>Revenue</th></tr>
            </thead>
            <tbody>${topRows || '<tr><td colspan="4">No data available.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);

    popup.document.close();
    popup.focus();
    popup.print();
  }

  private loadSummary(): void {
    this.loading.set(true);
    this.serverError.set(null);

    this.financeService.getFinancialSummary().subscribe({
      next: (response) => {
        this.shopNames.set((response?.shops || []).map((shop) => shop?.name || 'Shop'));
        this.totalSales.set(Number(response?.totalSales || 0));
        this.orders.set(response?.orders || []);
        this.topProducts.set(response?.topProducts || []);
        this.loading.set(false);
      },
      error: (error) => {
        this.serverError.set(error?.error?.message || 'Unable to load financial data.');
        this.loading.set(false);
      },
    });
  }

  private escapeHtml(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
