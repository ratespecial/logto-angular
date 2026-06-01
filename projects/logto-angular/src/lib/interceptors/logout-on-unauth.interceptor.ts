import {inject} from '@angular/core';
import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {tap} from 'rxjs/operators';
import {AuthService} from '../auth.service';

/**
 * If any /api call returns 401, sign the user out and send them to the login page.
 */
export const logoutOnUnauthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    tap({
      error: (err) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          authService.logout();
        }
      },
    }),
  );
};
