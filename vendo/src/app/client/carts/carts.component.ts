import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CartByShop, CartItem, CartProductRef, CartService } from '../shared/cart.service';
import { ClientOrdersService, PaidOrder, PaidOrderItem } from '../shared/orders.service';

interface InvoiceLine {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface InvoiceData {
  invoiceNumber: string;
  orderId: string;
  shopName: string;
  paidAt: string;
  pickupDate: string;
  paymentMethodLabel: string;
  cardLast4: string;
  cardHolderName: string;
  totalAmount: number;
  lines: InvoiceLine[];
}

interface PurchaseContext {
  cartId: string;
  shopId: string;
  shopName: string;
  selectedProductIds: string[];
  lines: InvoiceLine[];
  totalAmount: number;
}

@Component({
  selector: 'app-client-carts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carts.component.html',
  styleUrl: './carts.component.css',
})
export class ClientCartsComponent implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly ordersService = inject(ClientOrdersService);

  readonly loading = signal(true);
  readonly serverError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly carts = signal<CartByShop[]>([]);
  readonly updateQuantityItemId = signal<string | null>(null);
  readonly removeItemLoadingId = signal<string | null>(null);

  readonly paymentModalOpen = signal(false);
  readonly paymentSubmitting = signal(false);
  readonly paymentError = signal<string | null>(null);
  readonly pendingPurchase = signal<PurchaseContext | null>(null);

  readonly paymentMethod = signal<'bank_card' | 'visa'>('bank_card');
  readonly cardHolderName = signal('');
  readonly cardNumber = signal('');
  readonly pickupDate = signal('');

  readonly latestInvoice = signal<InvoiceData | null>(null);
  readonly invoiceModalOpen = signal(false);

  ngOnInit(): void {
    this.loadCarts();
  }

  openPaymentForAll(cart: CartByShop): void {
    const lines = cart.items.map((item) => ({
      productName: this.getProductName(item),
      quantity: Number(item.quantity || 0),
      unitPrice: this.getProductPrice(item),
      subtotal: this.getProductSubtotal(item),
    }));

    const selectedProductIds = cart.items
      .map((item) => this.extractProductId(item.productId))
      .filter((id) => !!id);

    this.openPaymentModal({
      cartId: cart.cartId,
      shopId: cart.shopId,
      shopName: cart.shopName,
      selectedProductIds,
      lines,
      totalAmount: cart.totalAmount,
    });
  }

  openPaymentForItem(cart: CartByShop, item: CartItem): void {
    const productId = this.extractProductId(item.productId);
    if (!productId) {
      return;
    }

    const line: InvoiceLine = {
      productName: this.getProductName(item),
      quantity: Number(item.quantity || 0),
      unitPrice: this.getProductPrice(item),
      subtotal: this.getProductSubtotal(item),
    };

    this.openPaymentModal({
      cartId: cart.cartId,
      shopId: cart.shopId,
      shopName: cart.shopName,
      selectedProductIds: [productId],
      lines: [line],
      totalAmount: line.subtotal,
    });
  }

  closePaymentModal(): void {
    this.paymentModalOpen.set(false);
    this.paymentSubmitting.set(false);
    this.paymentError.set(null);
    this.pendingPurchase.set(null);
    this.cardNumber.set('');
  }

  submitPayment(): void {
    const context = this.pendingPurchase();
    if (!context) {
      return;
    }

    const cardHolderName = this.cardHolderName().trim();
    const cardNumber = this.cardNumber().replace(/\s+/g, '');
    const pickupDate = this.pickupDate().trim();

    if (!cardHolderName) {
      this.paymentError.set('Le nom sur la carte est requis.');
      return;
    }

    if (!/^\d{12,19}$/.test(cardNumber)) {
      this.paymentError.set('Le numero de carte doit contenir entre 12 et 19 chiffres.');
      return;
    }

    if (!pickupDate) {
      this.paymentError.set('La date de recuperation est requise.');
      return;
    }

    this.paymentSubmitting.set(true);
    this.paymentError.set(null);
    this.serverError.set(null);
    this.successMessage.set(null);

    this.cartService.checkout(context.shopId, context.selectedProductIds).subscribe({
      next: (checkoutResponse) => {
        const orderId = String(checkoutResponse?.order?._id || '');
        if (!orderId) {
          this.paymentSubmitting.set(false);
          this.paymentError.set('Commande invalide apres checkout.');
          return;
        }

        this.ordersService
          .payOrder(orderId, {
            paymentMethod: this.paymentMethod(),
            cardHolderName,
            cardNumber,
            pickupDate,
          })
          .subscribe({
            next: (payResponse) => {
              this.paymentSubmitting.set(false);
              this.successMessage.set('Paiement valide. Votre commande est confirmee.');

              this.latestInvoice.set(
                this.buildInvoice(
                  payResponse?.order,
                  payResponse?.items || [],
                  context,
                  cardHolderName,
                  cardNumber,
                  pickupDate
                )
              );

              this.closePaymentModal();
              this.loadCarts();
            },
            error: (error) => {
              this.paymentSubmitting.set(false);
              this.paymentError.set(error?.error?.message || 'Paiement refuse.');
            },
          });
      },
      error: (error) => {
        this.paymentSubmitting.set(false);
        this.paymentError.set(error?.error?.message || 'Impossible de lancer le checkout.');
      },
    });
  }

  openInvoiceModal(): void {
    if (!this.latestInvoice()) {
      return;
    }
    this.invoiceModalOpen.set(true);
  }

  closeInvoiceModal(): void {
    this.invoiceModalOpen.set(false);
  }

  exportInvoiceAsPdf(): void {
    const invoice = this.latestInvoice();
    if (!invoice || typeof window === 'undefined') {
      return;
    }

    const lineRows = invoice.lines
      .map(
        (line) =>
          `<tr>
            <td>${this.escapeHtml(line.productName)}</td>
            <td>${line.quantity}</td>
            <td>Ar ${line.unitPrice.toLocaleString('fr-FR')}</td>
            <td>Ar ${line.subtotal.toLocaleString('fr-FR')}</td>
          </tr>`
      )
      .join('');

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      this.serverError.set("Impossible d'ouvrir la fenetre d'impression.");
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Facture ${this.escapeHtml(invoice.invoiceNumber)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { margin-bottom: 6px; }
            .meta { margin-bottom: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
            .total { margin-top: 14px; font-size: 18px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>Facture ${this.escapeHtml(invoice.invoiceNumber)}</h1>
          <div class="meta">
            <div><strong>Commande:</strong> ${this.escapeHtml(invoice.orderId)}</div>
            <div><strong>Boutique:</strong> ${this.escapeHtml(invoice.shopName)}</div>
            <div><strong>Date paiement:</strong> ${this.escapeHtml(invoice.paidAt)}</div>
            <div><strong>Date recuperation:</strong> ${this.escapeHtml(invoice.pickupDate)}</div>
            <div><strong>Paiement:</strong> ${this.escapeHtml(invoice.paymentMethodLabel)} •••• ${this.escapeHtml(invoice.cardLast4)}</div>
            <div><strong>Titulaire:</strong> ${this.escapeHtml(invoice.cardHolderName)}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Qte</th>
                <th>Prix unitaire</th>
                <th>Sous-total</th>
              </tr>
            </thead>
            <tbody>${lineRows}</tbody>
          </table>
          <div class="total">Total: Ar ${invoice.totalAmount.toLocaleString('fr-FR')}</div>
        </body>
      </html>
    `);

    popup.document.close();
    popup.focus();
    popup.print();
  }

  onQuantityChange(cart: CartByShop, item: CartItem, value: string): void {
    const maxQuantity = this.getMaxQuantity(item);
    const parsedValue = Number.parseInt(value, 10) || 1;
    const newQuantity = Math.max(1, Math.min(maxQuantity, parsedValue));
    const previousQuantity = Number(item.quantity || 1);
    if (newQuantity === previousQuantity) {
      return;
    }

    this.serverError.set(null);
    this.successMessage.set(null);
    this.updateQuantityItemId.set(item._id);

    this.setItemQuantityLocal(cart.cartId, item._id, newQuantity);

    this.cartService.updateItemQuantity(item._id, newQuantity).subscribe({
      next: () => {
        this.updateQuantityItemId.set(null);
      },
      error: (error) => {
        this.setItemQuantityLocal(cart.cartId, item._id, previousQuantity);
        this.updateQuantityItemId.set(null);
        this.serverError.set(error?.error?.message || 'Impossible de modifier la quantite.');
      },
    });
  }

  removeCartItem(cart: CartByShop, item: CartItem): void {
    this.serverError.set(null);
    this.successMessage.set(null);
    this.removeItemLoadingId.set(item._id);

    this.cartService.removeItem(item._id).subscribe({
      next: () => {
        this.removeItemLoadingId.set(null);
        this.removeItemLocal(cart.cartId, item._id);
        this.successMessage.set('Article annule et retire du panier.');
      },
      error: (error) => {
        this.removeItemLoadingId.set(null);
        this.serverError.set(error?.error?.message || "Impossible d'annuler cet article.");
      },
    });
  }

  getProductName(item: CartItem): string {
    const product = item?.productId;
    if (typeof product === 'string') {
      return 'Produit';
    }
    return product?.name?.trim() || 'Produit';
  }

  getProductPrice(item: CartItem): number {
    const product = item?.productId;
    if (typeof product === 'string') {
      return 0;
    }
    return Number(product?.price || 0);
  }

  getProductSubtotal(item: CartItem): number {
    return this.getProductPrice(item) * Number(item?.quantity || 0);
  }

  getProductImageUrl(item: CartItem): string | null {
    const product = item?.productId;
    if (!product || typeof product === 'string') {
      return null;
    }

    const images = Array.isArray(product.images) ? product.images : [];
    if (!images.length) {
      return null;
    }

    const first = images[0];
    if (first && typeof first === 'object' && 'url' in first && typeof first.url === 'string') {
      return first.url.trim() || null;
    }

    return typeof first === 'string' && first.trim().length > 0 ? first : null;
  }

  isUpdatingQuantity(itemId: string): boolean {
    return this.updateQuantityItemId() === itemId;
  }

  isRemovingItem(itemId: string): boolean {
    return this.removeItemLoadingId() === itemId;
  }

  getMaxQuantity(item: CartItem): number {
    const product = item?.productId;
    const stock = typeof product === 'string' ? 0 : Number(product?.stock || 0);
    return Math.max(1, stock || Number(item.quantity || 1));
  }

  getTodayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  setPaymentMethod(value: string): void {
    this.paymentMethod.set(value === 'visa' ? 'visa' : 'bank_card');
  }

  private openPaymentModal(context: PurchaseContext): void {
    this.pendingPurchase.set(context);
    this.paymentError.set(null);
    this.paymentSubmitting.set(false);
    this.paymentMethod.set('bank_card');
    this.cardHolderName.set('');
    this.cardNumber.set('');
    this.pickupDate.set('');
    this.paymentModalOpen.set(true);
  }

  private loadCarts(): void {
    this.loading.set(true);
    this.serverError.set(null);

    this.cartService.getMyCarts().subscribe({
      next: (response) => {
        this.carts.set(response?.carts || []);
        this.loading.set(false);
      },
      error: (error) => {
        this.carts.set([]);
        this.serverError.set(error?.error?.message || 'Impossible de charger vos paniers.');
        this.loading.set(false);
      },
    });
  }

  private extractProductId(product: string | CartProductRef): string {
    return typeof product === 'string' ? product : String(product?._id || '');
  }

  private setItemQuantityLocal(cartId: string, itemId: string, quantity: number): void {
    this.carts.update((carts) =>
      carts
        .map((cart) => {
          if (cart.cartId !== cartId) {
            return cart;
          }
          const items = cart.items.map((item) =>
            item._id === itemId ? { ...item, quantity } : item
          );
          return this.computeCartTotals({ ...cart, items });
        })
        .filter((cart) => cart.items.length > 0)
    );
  }

  private removeItemLocal(cartId: string, itemId: string): void {
    this.carts.update((carts) =>
      carts
        .map((cart) => {
          if (cart.cartId !== cartId) {
            return cart;
          }
          const items = cart.items.filter((item) => item._id !== itemId);
          return this.computeCartTotals({ ...cart, items });
        })
        .filter((cart) => cart.items.length > 0)
    );
  }

  private computeCartTotals(cart: CartByShop): CartByShop {
    const totalItems = cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalAmount = cart.items.reduce(
      (sum, item) => sum + this.getProductPrice(item) * Number(item.quantity || 0),
      0
    );
    return {
      ...cart,
      totalItems,
      totalAmount,
    };
  }

  private buildInvoice(
    order: PaidOrder | undefined,
    paidItems: PaidOrderItem[],
    context: PurchaseContext,
    cardHolderName: string,
    cardNumber: string,
    pickupDate: string
  ): InvoiceData {
    const localNameByProductId = new Map<string, string>();
    context.lines.forEach((line, index) => {
      const productId = context.selectedProductIds[index] || '';
      if (productId) {
        localNameByProductId.set(productId, line.productName);
      }
    });

    const lines = (paidItems || []).map((item) => {
      const productId = String(item.productId || '');
      const name =
        String(item.productName || '').trim() ||
        localNameByProductId.get(productId) ||
        'Produit';
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.priceAtPurchase || 0);
      return {
        productName: name,
        quantity,
        unitPrice,
        subtotal: quantity * unitPrice,
      };
    });

    const totalAmount =
      lines.length > 0
        ? lines.reduce((sum, line) => sum + line.subtotal, 0)
        : Number(order?.totalAmount || context.totalAmount || 0);

    const paidAtValue = order?.paidAt ? new Date(order.paidAt) : new Date();
    const paidAt = Number.isNaN(paidAtValue.getTime())
      ? new Date().toLocaleString('fr-FR')
      : paidAtValue.toLocaleString('fr-FR');

    const pickupDateValue = new Date(pickupDate);
    const pickupDateLabel = Number.isNaN(pickupDateValue.getTime())
      ? pickupDate
      : pickupDateValue.toLocaleDateString('fr-FR');

    const method = order?.paymentMethod || this.paymentMethod();

    return {
      invoiceNumber: `FAC-${Date.now()}`,
      orderId: String(order?._id || ''),
      shopName: context.shopName,
      paidAt,
      pickupDate: pickupDateLabel,
      paymentMethodLabel: method === 'visa' ? 'Visa' : 'Carte bancaire',
      cardLast4: String(order?.cardLast4 || cardNumber.slice(-4) || ''),
      cardHolderName: String(order?.cardHolderName || cardHolderName),
      totalAmount,
      lines: lines.length > 0 ? lines : context.lines,
    };
  }

  private escapeHtml(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

