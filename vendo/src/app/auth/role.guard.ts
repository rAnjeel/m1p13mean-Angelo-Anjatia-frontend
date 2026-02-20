import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const getStoredRole = (): string | null => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  const rawUser = localStorage.getItem('auth_user');
  if (!rawUser) {
    return null;
  }

  try {
    const user = JSON.parse(rawUser) as { role?: string };
    return typeof user.role === 'string' ? user.role.trim().toLowerCase() : null;
  } catch {
    return null;
  }
};

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const allowedRoles = ((route.data?.['roles'] as string[] | undefined) ?? []).map((role) =>
    role.toLowerCase()
  );

  if (allowedRoles.length === 0) {
    return true;
  }

  const currentRole = getStoredRole();
  if (!currentRole) {
    return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
  }

  if (!allowedRoles.includes(currentRole)) {
    return router.createUrlTree(['/unauthorized']);
  }

  return true;
};
