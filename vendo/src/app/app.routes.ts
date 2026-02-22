import { Routes } from '@angular/router';
import { RegisterComponent } from './auth/register/register.component';
import { LoginComponent } from './auth/login/login.component';
import { DashboardComponent } from './admin/dashboard/dashboard.component';
import { ShopsComponent } from './admin/shops/shops.component';
import { UsersComponent } from './admin/users/users.component';
import { CategoriesComponent } from './admin/categories/categories.component';
import { ShopkeeperProductsComponent } from './shopkeeper/products/products.component';
import { UnauthorizedComponent } from './shared/unauthorized/unauthorized.component';
import { AboutUserComponent } from './shared/about-user/about-user.component';
import { roleGuard } from './auth/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  {
    path: 'admin/dashboard',
    component: DashboardComponent,
    canActivate: [roleGuard],
    data: { roles: ['admin', 'client'] },
  },
  { path: 'home', redirectTo: 'admin/dashboard', pathMatch: 'full' },
  {
    path: 'admin/shops',
    component: ShopsComponent,
    canActivate: [roleGuard],
    data: { roles: ['admin', 'client'] },
  },
  {
    path: 'admin/categories',
    component: CategoriesComponent,
    canActivate: [roleGuard],
    data: { roles: ['admin', 'shopkeeper'] },
  },
  {
    path: 'admin/users',
    component: UsersComponent,
    canActivate: [roleGuard],
    data: { roles: ['admin', 'client'] },
  },
  {
    path: 'shopkeeper/products',
    component: ShopkeeperProductsComponent,
    canActivate: [roleGuard],
    data: { roles: ['shopkeeper'] },
  },
  {
    path: 'profile/about',
    component: AboutUserComponent,
    canActivate: [roleGuard],
    data: { roles: ['admin', 'client', 'shopkeeper'] },
  },
  { path: 'unauthorized', component: UnauthorizedComponent },
  { path: '**', redirectTo: 'unauthorized' },
];
