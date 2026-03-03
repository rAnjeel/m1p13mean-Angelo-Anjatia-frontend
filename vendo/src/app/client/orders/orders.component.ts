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

  isPaidOrder(order: ClientOrderWithItems): boolean {
    return String(order?.status || '').toLowerCase() === 'paid';
  }

  printPaidOrder(order: ClientOrderWithItems): void {
    if (!this.isPaidOrder(order)) {
      return;
    }
    const html = this.buildReceiptHtml(order);
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.setAttribute('aria-hidden', 'true');
    document.body.appendChild(frame);

    const cleanup = () => {
      setTimeout(() => {
        if (frame.parentNode) {
          frame.parentNode.removeChild(frame);
        }
      }, 500);
    };

    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) {
        cleanup();
        return;
      }
      win.focus();
      win.print();
      cleanup();
    };

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) {
      cleanup();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
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

  private buildReceiptHtml(order: ClientOrderWithItems): string {
    const items = (order?.items || [])
      .map((item) => {
        const productName = this.escapeHtml(String(item?.productName || 'Produit'));
        const qty = Number(item?.quantity || 0);
        const unit = `Ar ${this.formatAmount(Number(item?.priceAtPurchase || 0))}`;
        const lineTotal = `Ar ${this.formatAmount(Number(item?.priceAtPurchase || 0) * qty)}`;
        return `
          <tr>
            <td>${productName}</td>
            <td>${qty}</td>
            <td>${this.escapeHtml(unit)}</td>
            <td>${this.escapeHtml(lineTotal)}</td>
          </tr>
        `;
      })
      .join('');

    const orderRef = this.escapeHtml(String(order?._id || 'N/A'));
    const createdAt = this.escapeHtml(this.formatDate(order?.createdAt));
    const paidAt = this.escapeHtml(this.formatDate(order?.paidAt || order?.createdAt));
    const paymentMethod = this.escapeHtml(this.getPaymentMethodLabel(order?.paymentMethod));
    const total = this.escapeHtml(`Ar ${this.formatAmount(Number(order?.totalAmount || 0))}`);

    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Recu commande ${orderRef}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #1f2937; margin: 24px; }
    .head { margin-bottom: 16px; }
    .title { margin: 0 0 4px; font-size: 22px; }
    .meta { margin: 2px 0; font-size: 13px; color: #4b5563; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 13px; text-align: left; }
    tfoot td { font-weight: 700; }
    .right { text-align: right; }
    .footer { margin-top: 18px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="head">
    <h1 class="title">Recu de paiement</h1>
    <p class="meta">Reference commande: ${orderRef}</p>
    <p class="meta">Date commande: ${createdAt}</p>
    <p class="meta">Date paiement: ${paidAt}</p>
    <p class="meta">Mode de paiement: ${paymentMethod}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Produit</th>
        <th>Quantite</th>
        <th>Prix unitaire</th>
        <th>Montant</th>
      </tr>
    </thead>
    <tbody>
      ${items || '<tr><td colspan="4">Aucun article</td></tr>'}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" class="right">Total paye</td>
        <td>${total}</td>
      </tr>
    </tfoot>
  </table>

  <p class="footer">Merci pour votre achat.</p>
</body>
</html>`;
  }

  private getPaymentMethodLabel(method?: string): string {
    const value = String(method || '').toLowerCase();
    if (value === 'bank_card') return 'Carte bancaire';
    if (value === 'visa') return 'Visa';
    return 'Non precise';
  }

  private escapeHtml(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
