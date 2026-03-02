import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Product,
  ProductCategory,
  ShopOption,
  ShopkeeperProductsService,
} from '../../shopkeeper/products/products.service';
import { CartService } from '../shared/cart.service';
import { ProductReview, ProductReviewsService } from '../shared/product-reviews.service';

@Component({
  selector: 'app-client-products',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
})
export class ClientProductsComponent implements OnInit {
  private readonly productsService = inject(ShopkeeperProductsService);
  private readonly cartService = inject(CartService);
  private readonly productReviewsService = inject(ProductReviewsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly serverError = signal<string | null>(null);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<ProductCategory[]>([]);
  readonly shops = signal<ShopOption[]>([]);

  readonly selectedCategory = signal('all');
  readonly selectedShop = signal('all');
  readonly searchTerm = signal('');
  readonly selectedProductForReview = signal<Product | null>(null);
  readonly addToCartLoadingProductId = signal<string | null>(null);
  readonly addToCartError = signal<string | null>(null);
  readonly addToCartSuccess = signal<string | null>(null);
  readonly reviewRating = signal(0);
  readonly reviewComment = signal('');
  readonly reviewSubmitting = signal(false);
  readonly reviewLoading = signal(false);
  readonly reviewError = signal<string | null>(null);
  readonly reviewSuccess = signal<string | null>(null);
  readonly productReviews = signal<ProductReview[]>([]);
  readonly stars = [1, 2, 3, 4, 5];

  readonly filteredProducts = computed(() => {
    const category = this.selectedCategory();
    const shop = this.selectedShop();
    const search = this.searchTerm().trim().toLowerCase();

    return this.products().filter((product) => {
      const productCategoryId = this.extractCategoryId(product);
      const productShopId = this.extractShopId(product);
      const productShopName = this.getProductShopName(product).toLowerCase();
      const productCategoryName = this.getProductCategoryName(product).toLowerCase();
      const productName = (product.name || '').toLowerCase();

      if (category !== 'all' && productCategoryId !== category) {
        return false;
      }

      if (shop !== 'all' && productShopId !== shop) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        productName.includes(search) ||
        productShopName.includes(search) ||
        productCategoryName.includes(search)
      );
    });
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const category = params.get('category');
      const shop = params.get('shop');
      const search = params.get('search');

      this.selectedCategory.set(category && category.trim() ? category : 'all');
      this.selectedShop.set(shop && shop.trim() ? shop : 'all');
      this.searchTerm.set(search || '');
    });

    this.loadData();
  }

  setCategory(categoryId: string): void {
    this.selectedCategory.set(categoryId);
    this.updateQueryParams();
  }

  setShop(shopId: string): void {
    this.selectedShop.set(shopId);
    this.updateQueryParams();
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value || '');
    this.updateQueryParams();
  }

  addProductToCart(product: Product, event: Event): void {
    event.stopPropagation();

    if (!product?._id || product.stock <= 0 || !product.isActive) {
      this.addToCartError.set('Ce produit ne peut pas etre ajoute au panier.');
      this.addToCartSuccess.set(null);
      return;
    }

    this.addToCartError.set(null);
    this.addToCartSuccess.set(null);
    this.addToCartLoadingProductId.set(product._id);

    this.cartService.addToCart(product._id, 1).subscribe({
      next: () => {
        this.addToCartLoadingProductId.set(null);
        this.addToCartSuccess.set(`Produit ajoute au panier: ${product.name}.`);
      },
      error: (error) => {
        this.addToCartLoadingProductId.set(null);
        this.addToCartError.set(error?.error?.message || 'Impossible d ajouter le produit au panier.');
      },
    });
  }

  isAddingToCart(productId: string): boolean {
    return this.addToCartLoadingProductId() === productId;
  }

  openReviewFromButton(product: Product, event: Event): void {
    event.stopPropagation();
    this.openReviewPopup(product);
  }

  getProductCategoryName(product: Product): string {
    const category = product.categoryId;
    if (typeof category === 'string') {
      const found = this.categories().find((item) => item._id === category);
      return found?.name || 'Categorie';
    }
    return category?.name || 'Categorie';
  }

  getProductShopName(product: Product): string {
    const shop = product.shopId;
    if (typeof shop === 'string') {
      const found = this.shops().find((item) => item._id === shop);
      return found?.name || 'Boutique';
    }
    return shop?.name || 'Boutique';
  }

  getProductImageUrl(product: Product): string | null {
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

  getSelectedReviewShopName(): string {
    const product = this.selectedProductForReview();
    return product ? this.getProductShopName(product) : '';
  }

  openReviewPopup(product: Product): void {
    this.selectedProductForReview.set(product);
    this.reviewRating.set(0);
    this.reviewComment.set('');
    this.reviewSubmitting.set(false);
    this.reviewError.set(null);
    this.reviewSuccess.set(null);
    this.loadReviews(product._id);
  }

  closeReviewPopup(): void {
    this.selectedProductForReview.set(null);
    this.reviewRating.set(0);
    this.reviewComment.set('');
    this.reviewSubmitting.set(false);
    this.reviewLoading.set(false);
    this.reviewError.set(null);
    this.reviewSuccess.set(null);
    this.productReviews.set([]);
  }

  setReviewRating(rating: number): void {
    this.reviewRating.set(Math.min(5, Math.max(1, Number(rating) || 0)));
  }

  onReviewCommentInput(value: string): void {
    this.reviewComment.set(String(value || ''));
  }

  submitReview(): void {
    const product = this.selectedProductForReview();
    if (!product?._id) {
      return;
    }

    const rating = this.reviewRating();
    if (rating < 1 || rating > 5) {
      this.reviewError.set("Choisissez une note d'au moins 1 etoile.");
      return;
    }

    this.reviewSubmitting.set(true);
    this.reviewError.set(null);
    this.reviewSuccess.set(null);

    this.productReviewsService
      .add(product._id, {
        rating,
        comment: this.reviewComment().trim(),
      })
      .subscribe({
        next: () => {
          this.reviewSubmitting.set(false);
          this.reviewSuccess.set('Votre avis a ete enregistre.');
          this.reviewRating.set(0);
          this.reviewComment.set('');
          this.loadReviews(product._id);
        },
        error: (error) => {
          const message =
            error?.error?.message || "Impossible d'envoyer l'avis pour le moment.";
          this.reviewError.set(message);
          this.reviewSubmitting.set(false);
        },
      });
  }

  getReviewClientName(review: ProductReview): string {
    const client = review?.clientId;
    if (typeof client === 'string') {
      return 'Client';
    }
    return client?.fullName || 'Client';
  }

  formatReviewDate(dateValue?: string): string {
    if (!dateValue) return '';
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('fr-FR');
  }

  private loadData(): void {
    this.loading.set(true);
    this.serverError.set(null);

    this.productsService.getProducts().subscribe({
      next: (response) => {
        this.products.set(response?.products || []);
        this.loading.set(false);
      },
      error: () => {
        this.serverError.set('Impossible de charger les produits.');
        this.loading.set(false);
      },
    });

    this.productsService.getProductCategories().subscribe({
      next: (response) => {
        this.categories.set(response?.categories || []);
      },
      error: () => {
        this.categories.set([]);
      },
    });

    this.productsService.getShops().subscribe({
      next: (response) => {
        this.shops.set(response?.shops || []);
      },
      error: () => {
        this.shops.set([]);
      },
    });
  }

  private extractCategoryId(product: Product): string {
    const category = product.categoryId;
    return typeof category === 'string' ? category : String(category?._id || '');
  }

  private extractShopId(product: Product): string {
    const shop = product.shopId;
    return typeof shop === 'string' ? shop : String(shop?._id || '');
  }

  private updateQueryParams(): void {
    const category = this.selectedCategory();
    const shop = this.selectedShop();
    const search = this.searchTerm().trim();

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: category !== 'all' ? category : null,
        shop: shop !== 'all' ? shop : null,
        search: search || null,
      },
      queryParamsHandling: 'merge',
    });
  }

  private loadReviews(productId: string): void {
    this.reviewLoading.set(true);
    this.reviewError.set(null);

    this.productReviewsService.getByProduct(productId).subscribe({
      next: (response) => {
        this.productReviews.set(response?.reviews || []);
        this.reviewLoading.set(false);
      },
      error: () => {
        this.productReviews.set([]);
        this.reviewLoading.set(false);
      },
    });
  }
}
