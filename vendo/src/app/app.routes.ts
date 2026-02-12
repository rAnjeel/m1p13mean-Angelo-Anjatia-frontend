import { Routes } from '@angular/router';
import { RegisterComponent } from './auth/register/register.component';
import { LoginComponent } from './auth/login/login.component';
import { DashboardComponent } from './admin/dashboard/dashboard.component';
import { ShopsComponent } from './admin/shops/shops.component';
import { UsersComponent } from './admin/users/users.component';
import { CategoriesComponent } from './admin/categories/categories.component';
import { ShopkeeperProductsComponent } from './shopkeeper/products/products.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: 'admin/dashboard', component: DashboardComponent },
  { path: 'home', redirectTo: 'admin/dashboard', pathMatch: 'full' },
  { path: 'admin/shops', component: ShopsComponent },
  { path: 'admin/categories', component: CategoriesComponent },
  { path: 'admin/users', component: UsersComponent },
  { path: 'shopkeeper/products', component: ShopkeeperProductsComponent },
];
