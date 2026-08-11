# logto-angular workspace

Angular library workspace containing the `@ratespecial/logto-angular` package.

## Package

See [`projects/logto-angular/README.md`](projects/logto-angular/README.md) for full documentation.

**`@ratespecial/logto-angular`** — Angular facade over `@logto/browser`. Provides:
- `provideLogtoAuth()` — one-call setup
- `authGuard` — session-checked route guard with post-login restoration
- `logtoTokenInterceptor` — resource-scoped Bearer tokens
- `logoutOnUnauthInterceptor` — 401 auto-logout
- dead-session recovery — a stale or rejected refresh token flushes storage and re-signs-in
  instead of wedging the app
- `CallbackComponent` / `SignedOutComponent` — OIDC callback handling and sign-out landing
- `HistoryService` + `initializeRouteTracking` — pre-login route persistence
- `@ratespecial/logto-angular/testing` secondary entry point with `provideLogtoTesting()`

## Commands

```bash
# Build the library
ng build logto-angular

# Run tests
ng test

# Build in watch mode (consumer must re-run `yarn install` after each build to pick up changes)
ng build logto-angular --watch
```
