import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ClientOrderWithItems, ClientOrdersService } from '../shared/orders.service';

@Component({
  selector: 'app-client-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
})
export class ClientOrdersComponent implements OnInit {
  private readonly ordersService = inject(ClientOrdersService);

  readonly loading = signal(true);
  readonly serverError = signal<string | null>(null);
  readonly orders = signal<ClientOrderWithItems[]>([]);
  readonly searchTerm = signal('');
  readonly selectedShop = signal('all');
  readonly shopSort = signal<'none' | 'asc' | 'desc'>('none');

  readonly totalSpent = computed(() =>
    this.orders().reduce((sum, order) => sum + Number(order?.totalAmount || 0), 0)
  );

  readonly totalOrders = computed(() => this.orders().length);

  readonly shopOptions = computed(() => {
    const names = new Set<string>();
    this.orders().forEach((order) => {
      this.getOrderShopNames(order).forEach((name) => names.add(name));
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  });

  readonly displayedOrders = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const selectedShop = this.selectedShop();
    const sortMode = this.shopSort();

    const filtered = this.orders().filter((order) => {
      const shopNames = this.getOrderShopNames(order);
      const id = String(order?._id || '').toLowerCase();
      const itemNames = (order?.items || []).map((item) => String(item?.productName || '').toLowerCase());

      if (selectedShop !== 'all' && !shopNames.includes(selectedShop)) {
        return false;
      }

      if (!search) {
        return true;
      }

      const searchInShops = shopNames.some((name) => name.toLowerCase().includes(search));
      const searchInItems = itemNames.some((name) => name.includes(search));
      return id.includes(search) || searchInShops || searchInItems;
    });

    if (sortMode === 'none') {
      return filtered;
    }

    return [...filtered].sort((left, right) => {
      const leftName = this.getOrderPrimaryShopName(left);
      const rightName = this.getOrderPrimaryShopName(right);
      const compare = leftName.localeCompare(rightName, 'fr', { sensitivity: 'base' });
      return sortMode === 'asc' ? compare : -compare;
    });
  });

  ngOnInit(): void {
    this.loadOrders();
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(String(value || ''));
  }

  onShopFilterChange(value: string): void {
    this.selectedShop.set(String(value || 'all'));
  }

  onShopSortChange(value: string): void {
    if (value === 'asc' || value === 'desc' || value === 'none') {
      this.shopSort.set(value);
      return;
    }
    this.shopSort.set('none');
  }

  getOrderItemCount(order: ClientOrderWithItems): number {
    return (order?.items || []).reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
  }

  getOrderShopNames(order: ClientOrderWithItems): string[] {
    const names = new Set<string>();
    (order?.items || []).forEach((item) => {
      const name = String(item?.shopName || '').trim();
      if (name) names.add(name);
    });
    if (!names.size) {
      names.add('Boutique');
    }
    return Array.from(names);
  }

  getOrderPrimaryShopName(order: ClientOrderWithItems): string {
    return this.getOrderShopNames(order)[0] || 'Boutique';
  }

  formatAmount(amount: number): string {
    return Number(amount || 0).toLocaleString('fr-FR');
  }

  formatDate(value?: string): string {
    if (!value) return 'Date inconnue';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date inconnue';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getStatusLabel(status?: string): string {
    const value = String(status || '').toLowerCase();
    if (value === 'paid') return 'Payée';
    if (value === 'pending') return 'En attente';
    if (value === 'cancelled') return 'Annulée';
    return status || 'Inconnu';
  }

  getStatusClass(status?: string): string {
    const value = String(status || '').toLowerCase();
    if (value === 'paid') return 'status-paid';
    if (value === 'pending') return 'status-pending';
    if (value === 'cancelled') return 'status-cancelled';
    return 'status-default';
  }

  private loadOrders(): void {
    this.loading.set(true);
    this.serverError.set(null);

    this.ordersService.getMyOrders().subscribe({
      next: (response) => {
        this.orders.set(response?.orders || []);
        this.loading.set(false);
      },
      error: () => {
        this.serverError.set('Impossible de charger vos commandes pour le moment.');
        this.loading.set(false);
      },
    });
  }
}
