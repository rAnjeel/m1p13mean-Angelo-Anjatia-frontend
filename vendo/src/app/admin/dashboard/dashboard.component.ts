import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DashboardService, ShopsByCategoryRow, UsersByMonthRow } from './dashboard.service';

interface ShopActivityRow {
  categoryName: string;
  percent: number;
}

interface MonthlyBarRow {
  label: string;
  totalUsers: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly totalShops = signal(0);
  readonly totalUsers = signal(0);
  readonly totalRevenue = signal(0);
  readonly monthlyBars = signal<MonthlyBarRow[]>([]);
  readonly shopActivity = signal<ShopActivityRow[]>([]);
  readonly lastUpdate = signal<string>('');

  ngOnInit(): void {
    this.loadDashboard();
  }

  formatRevenueAr(value: number): string {
    return `Ar ${Number(value || 0).toLocaleString('fr-FR')}`;
  }

  formatNumber(value: number): string {
    return Number(value || 0).toLocaleString('fr-FR');
  }

  getBarHeight(totalUsers: number): string {
    const bars = this.monthlyBars();
    const max = Math.max(...bars.map((bar) => bar.totalUsers), 0);
    if (max <= 0) {
      return '10%';
    }
    const normalized = (Number(totalUsers || 0) / max) * 100;
    return `${Math.max(10, Math.min(100, normalized))}%`;
  }

  exportDashboardPdf(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const monthlyRows = this.monthlyBars()
      .map(
        (bar) => `
          <tr>
            <td>${this.escapeHtml(bar.label)}</td>
            <td>${this.formatNumber(bar.totalUsers)}</td>
          </tr>
        `
      )
      .join('');

    const activityRows = this.shopActivity()
      .map(
        (row) => `
          <tr>
            <td>${this.escapeHtml(row.categoryName)}</td>
            <td>${row.percent}%</td>
          </tr>
        `
      )
      .join('');

    const popup = window.open('', '_blank', 'width=980,height=760');
    if (!popup) {
      this.error.set("Impossible d'ouvrir la fenetre d'impression.");
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Dashboard admin</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; padding: 22px; }
            h1 { margin: 0 0 4px; }
            .muted { color: #4b5563; margin: 0 0 14px; }
            .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
            .kpi { border: 1px solid #d8dbe4; border-radius: 8px; padding: 10px; }
            .kpi .label { font-size: 11px; text-transform: uppercase; color: #6b7280; }
            .kpi .value { font-size: 20px; font-weight: 700; margin-top: 6px; }
            h2 { margin: 14px 0 8px; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th, td { border: 1px solid #e5e7eb; text-align: left; padding: 8px; font-size: 13px; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Admin Dashboard</h1>
          <p class="muted">Export du ${this.escapeHtml(new Date().toLocaleString('fr-FR'))}</p>

          <section class="kpis">
            <div class="kpi">
              <div class="label">Total shops</div>
              <div class="value">${this.formatNumber(this.totalShops())}</div>
            </div>
            <div class="kpi">
              <div class="label">Active users</div>
              <div class="value">${this.formatNumber(this.totalUsers())}</div>
            </div>
            <div class="kpi">
              <div class="label">Revenue (10% paid orders + rents)</div>
              <div class="value">${this.escapeHtml(this.formatRevenueAr(this.totalRevenue()))}</div>
            </div>
          </section>

          <h2>Monthly performance</h2>
          <table>
            <thead>
              <tr><th>Mois</th><th>Utilisateurs crees</th></tr>
            </thead>
            <tbody>${monthlyRows}</tbody>
          </table>

          <h2>Shop activity</h2>
          <table>
            <thead>
              <tr><th>Categorie</th><th>Pourcentage</th></tr>
            </thead>
            <tbody>${activityRows}</tbody>
          </table>
        </body>
      </html>
    `);

    popup.document.close();
    popup.focus();
    popup.print();
  }

  private loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      totalShops: this.dashboardService.getTotalShops(),
      totalUsers: this.dashboardService.getTotalUsers(),
      totalRevenue: this.dashboardService.getTotalRevenue(),
      shopsByCategory: this.dashboardService.getShopsByCategory(),
      usersMonthly: this.dashboardService.getUsersMonthly(6),
    }).subscribe({
      next: (response) => {
        this.totalShops.set(Number(response.totalShops?.totalShops || 0));
        this.totalUsers.set(Number(response.totalUsers?.totalUsers || 0));
        this.totalRevenue.set(Number(response.totalRevenue?.totalRevenue || 0));

        this.monthlyBars.set(this.toMonthlyBars(response.usersMonthly?.totalUsersMonthly || []));
        this.shopActivity.set(this.toShopActivity(response.shopsByCategory?.shopsByCategory || []));
        this.lastUpdate.set(new Date().toLocaleString('fr-FR'));
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.message || 'Impossible de charger le dashboard.');
        this.loading.set(false);
      },
    });
  }

  private toMonthlyBars(rows: UsersByMonthRow[]): MonthlyBarRow[] {
    return (rows || []).map((row) => {
      const month = String(row?.month || '');
      const label = this.getMonthLabel(month);
      return {
        label,
        totalUsers: Number(row?.totalUsers || 0),
      };
    });
  }

  private toShopActivity(rows: ShopsByCategoryRow[]): ShopActivityRow[] {
    const filtered = (rows || []).filter((row) => {
      if (!row) return false;
      if (row.categoryType) {
        return row.categoryType === 'shop';
      }
      return true;
    });

    const totalShopType = filtered.reduce((sum, row) => sum + Number(row?.totalShops || 0), 0);
    if (totalShopType <= 0) {
      return [];
    }

    return filtered
      .map((row) => ({
        categoryName: row.categoryName || 'Sans categorie',
        percent: Math.round((Number(row.totalShops || 0) * 100) / totalShopType),
      }))
      .sort((a, b) => b.percent - a.percent);
  }

  private getMonthLabel(monthKey: string): string {
    const parts = monthKey.split('-');
    if (parts.length !== 2) {
      return monthKey;
    }

    const year = Number(parts[0]);
    const monthIndex = Number(parts[1]) - 1;
    const date = new Date(year, monthIndex, 1);
    if (Number.isNaN(date.getTime())) {
      return monthKey;
    }
    return date.toLocaleDateString('fr-FR', { month: 'short' });
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
