import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_STORAGE_KEY = 'auth_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return next(req);
  }

  const token = localStorage.getItem(TOKEN_STORAGE_KEY)?.trim();
  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(authReq);
};
