import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProductCategory {
  _id: string;
  name: string;
  type: 'shop' | 'product';
}

export interface ShopMerchantRef {
  _id: string;
  fullName: string;
  email: string;
}

export interface ShopOption {
  _id: string;
  name: string;
  merchantId: string | ShopMerchantRef;
}

export interface ProductShopRef {
  _id: string;
  name: string;
  merchantId?: string;
}

export interface Product {
  _id: string;
  shopId: string | ProductShopRef;
  categoryId: string | ProductCategory;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images?: Array<string | { url?: string; publicId?: string; alt?: string; isPrimary?: boolean; order?: number }>;
  isActive: boolean;
  createdAt: string;
}

export interface ProductPayload {
  shopId: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  isActive: boolean;
}

export interface ProductReviewClientRef {
  _id?: string;
  fullName?: string;
}

export interface ProductReviewItem {
  _id: string;
  productId: string;
  clientId: string | ProductReviewClientRef;
  rating: number;
  comment?: string;
  createdAt?: string;
}

interface ProductsResponse {
  products: Product[];
}

export interface ProductMutationResponse {
  message: string;
  product: Product;
}

interface CategoriesResponse {
  categories: ProductCategory[];
}

interface ShopsResponse {
  shops: ShopOption[];
}

interface ProductReviewsResponse {
  reviews: ProductReviewItem[];
}

interface DeleteReviewResponse {
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ShopkeeperProductsService {
  private readonly http = inject(HttpClient);
  private readonly productsBaseUrl = 'http://localhost:3000/api/products';
  private readonly categoriesBaseUrl = 'http://localhost:3000/api/categories';
  private readonly shopsBaseUrl = 'http://localhost:3000/api/shops';

  getProducts(): Observable<ProductsResponse> {
    return this.http.get<ProductsResponse>(this.productsBaseUrl);
  }

  createProduct(payload: ProductPayload): Observable<ProductMutationResponse> {
    return this.http.post<ProductMutationResponse>(this.productsBaseUrl, payload);
  }

  updateProduct(
    productId: string,
    payload: Partial<ProductPayload>
  ): Observable<ProductMutationResponse> {
    return this.http.put<ProductMutationResponse>(`${this.productsBaseUrl}/${productId}`, payload);
  }

  uploadProductImages(
    productId: string,
    files: File[],
    replace = false
  ): Observable<ProductMutationResponse> {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    const replaceQuery = replace ? '?replace=true' : '';
    return this.http.post<ProductMutationResponse>(
      `${this.productsBaseUrl}/${productId}/images${replaceQuery}`,
      formData
    );
  }

  deleteProduct(productId: string): Observable<ProductMutationResponse> {
    // Backend deletes product images from Cloudinary automatically on product deletion.
    return this.http.delete<ProductMutationResponse>(`${this.productsBaseUrl}/${productId}`);
  }

  getProductCategories(): Observable<CategoriesResponse> {
    return this.http.get<CategoriesResponse>(`${this.categoriesBaseUrl}/type/product`);
  }

  getShops(): Observable<ShopsResponse> {
    return this.http.get<ShopsResponse>(this.shopsBaseUrl);
  }

  getProductReviews(productId: string): Observable<ProductReviewsResponse> {
    return this.http.get<ProductReviewsResponse>(`http://localhost:3000/api/reviews/${productId}`);
  }

  deleteProductReview(reviewId: string): Observable<DeleteReviewResponse> {
    return this.http.delete<DeleteReviewResponse>(`http://localhost:3000/api/reviews/${reviewId}`);
  }
}
