import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CartByShop, CartItem, CartProductRef, CartService } from '../shared/cart.service';

@Component({
  selector: 'app-client-carts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carts.component.html',
  styleUrl: './carts.component.css',
})
export class ClientCartsComponent implements OnInit {
  private readonly cartService = inject(CartService);

  readonly loading = signal(true);
  readonly serverError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly carts = signal<CartByShop[]>([]);
  readonly checkoutShopLoadingId = signal<string | null>(null);
  readonly checkoutItemLoadingId = signal<string | null>(null);
  readonly updateQuantityItemId = signal<string | null>(null);
  readonly removeItemLoadingId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCarts();
  }

  buyAllFromShop(cart: CartByShop): void {
    if (!cart?.shopId) {
      return;
    }

    this.successMessage.set(null);
    this.serverError.set(null);
    this.checkoutShopLoadingId.set(cart.shopId);

    this.cartService.checkout(cart.shopId, []).subscribe({
      next: () => {
        this.checkoutShopLoadingId.set(null);
        this.successMessage.set(`Achat de tous les produits valide pour ${cart.shopName}.`);
        this.loadCarts();
      },
      error: (error) => {
        this.checkoutShopLoadingId.set(null);
        this.serverError.set(error?.error?.message || 'Impossible de finaliser cet achat.');
      },
    });
  }

  buySingleProduct(cart: CartByShop, item: CartItem): void {
    const productId = this.extractProductId(item.productId);
    if (!cart?.shopId || !productId) {
      return;
    }

    this.successMessage.set(null);
    this.serverError.set(null);
    this.checkoutItemLoadingId.set(item._id);

    this.cartService.checkout(cart.shopId, [productId]).subscribe({
      next: () => {
        this.checkoutItemLoadingId.set(null);
        this.successMessage.set('Achat unitaire valide.');
        this.loadCarts();
      },
      error: (error) => {
        this.checkoutItemLoadingId.set(null);
        this.serverError.set(error?.error?.message || 'Impossible de finaliser cet achat unitaire.');
      },
    });
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

  isBuyingAll(shopId: string): boolean {
    return this.checkoutShopLoadingId() === shopId;
  }

  isBuyingItem(itemId: string): boolean {
    return this.checkoutItemLoadingId() === itemId;
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
}
