import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../auth.service';
import { SecureRouteMapping } from '../logto.config';
import { LOGTO_AUTH_CONFIG } from '../tokens';

/**
 * Picks the configured resource whose `routes` match a request URL, so the interceptor can
 * fetch the correct resource-scoped token. Returns `undefined` when no resource matches (the
 * request goes out without an Authorization header).
 */
export function resourceForUrl(
  url: string,
  secureRoutes: SecureRouteMapping[],
): string | undefined {
  const match = secureRoutes.find((mapping) =>
    mapping.routes.some((route) => url.startsWith(route)),
  );

  return match?.resource;
}

/**
 * Matches the outgoing URL against each configured resource's `routes`; on a match it fetches
 * that resource's access token (cached/refreshed by the Logto client) and attaches it as a
 * Bearer header. Requests that match no resource pass through unauthenticated.
 *
 * A dead session is handled inside `AuthService.getAccessToken()`, which flushes the stored
 * tokens and redirects to Logto, leaving this request pending until the page unloads. Note
 * that token-acquisition errors never reach `logoutOnUnauthInterceptor` — this interceptor is
 * registered first and so wraps it, and the errors are not `HttpErrorResponse`s anyway.
 */
export const logtoTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const { routing } = inject(LOGTO_AUTH_CONFIG);

  const resource = resourceForUrl(req.url, routing.secureRoutes);

  if (!resource) {
    return next(req);
  }

  const auth = inject(AuthService);

  return from(auth.getAccessToken(resource)).pipe(
    switchMap((token) => {
      if (token) {
        return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
      }

      return next(req);
    }),
  );
};
