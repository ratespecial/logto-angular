import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { LOGTO_AUTH_CONFIG, PRIMARY_RESOURCE } from '../tokens';
import { resourceForUrl } from './logto-token.interceptor';

/**
 * If a request for the primary resource returns 401, sign the user out and send them to the
 * login page. Requests that match no secure route are treated the same way.
 *
 * A 401 from a secondary resource only means the user lacks access to that API, not that their
 * session is dead, so it is passed through untouched for the app to handle.
 */
export const logoutOnUnauthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const { routing } = inject(LOGTO_AUTH_CONFIG);
  const primaryResource = inject(PRIMARY_RESOURCE);
  const resource = resourceForUrl(req.url, routing.secureRoutes);
  const isPrimary = resource === undefined || resource === primaryResource;

  return next(req).pipe(
    tap({
      error: (err) => {
        if (isPrimary && err instanceof HttpErrorResponse && err.status === 401) {
          authService.logout();
        }
      },
    }),
  );
};
