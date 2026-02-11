import { Routes } from '@angular/router';
import { RegisterComponent } from './auth/register/register.component';
import { LoginComponent } from './auth/login/login.component';
import { HomeComponent } from './home/home.component';
import { ShopsComponent } from './admin/shops/shops.component';
import { UsersComponent } from './admin/users/users.component';
import { CategoriesComponent } from './admin/categories/categories.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent },
  { path: 'admin/shops', component: ShopsComponent },
  { path: 'admin/categories', component: CategoriesComponent },
  { path: 'admin/users', component: UsersComponent },
];
