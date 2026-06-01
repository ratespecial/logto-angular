# @ratespecial/logto-angular

An Angular 21+ library that wraps [`@logto/browser`](https://docs.logto.io/sdk/browser) into an Angular-idiomatic authentication layer: a facade service, a route guard, two HTTP interceptors, callback and signed-out components, route-history tracking, a provider factory, and a test helper.

---

## Overview

- **Angular 21+ standalone** — no NgModules required.
- **Peer dependency on `@logto/browser` ^3.0.13** — one SDK client per app, shared across all resources.
- **Injection-token driven** — every configurable value flows through DI; no static singletons.
- **Signals + OnPush** — components use Angular signals; no Zone.js pressure.
- **Secondary entry point** — `@ratespecial/logto-angular/testing` ships test helpers separately so they are never bundled in production.

### Requirements

| Dependency | Version |
|---|---|
| `@angular/core` | ^21 |
| `@angular/common` | ^21 |
| `@angular/router` | ^21 |
| `@logto/browser` | ^3.0.13 |
| `rxjs` | ~7.8.0 |

---

## Installation

```bash
npm install @ratespecial/logto-angular @logto/browser
```

Or with Yarn:

```bash
yarn add @ratespecial/logto-angular @logto/browser
```

---

## Quick start

### 1. Wire providers in `app.config.ts`

```ts
import {APP_INITIALIZER, ApplicationConfig, provideAppInitializer} from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {provideRouter} from '@angular/router';
import {
  provideLogtoAuth,
  logtoTokenInterceptor,
  logoutOnUnauthInterceptor,
  initializeRouteTracking,
} from '@ratespecial/logto-angular';
import {environment} from './environments/environment';
import {routes} from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    provideHttpClient(
      withInterceptors([
        logtoTokenInterceptor,       // attaches Bearer tokens to matched routes
        logoutOnUnauthInterceptor,   // logs out on 401
      ]),
    ),

    provideLogtoAuth({
      ...environment.logto,
      logoutHookFactories: [
        // optional: runs inside injection context, so inject() works here
        // () => {
        //   const store = inject(Store);
        //   return () => store.dispatch(new ClearState());
        // },
      ],
    }),

    // Track routes so the user returns to where they were after login
    provideAppInitializer(initializeRouteTracking()),
  ],
};
```

### 2. Add auth routes in `app.routes.ts`

```ts
import {Routes} from '@angular/router';
import {getAuthRoutes, authGuard} from '@ratespecial/logto-angular';
import {environment} from './environments/environment';

export const routes: Routes = [
  {path: '', pathMatch: 'full', redirectTo: '/dashboard'},

  // Spread the callback + signed-out routes from the lib
  ...getAuthRoutes(environment.logto.routing),

  // Protect your app routes
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component'),
    canActivate: [authGuard],
  },
];
```

### 3. Define the environment config

```ts
// src/environments/environment.ts
import {UserScope} from '@logto/browser';
import {LogtoAuthConfig} from '@ratespecial/logto-angular';

export const environment = {
  logto: {
    endpoint: 'https://your-tenant.logto.app',
    appId: 'your-app-id',
    scopes: [UserScope.Email, UserScope.Profile, 'app:read'],
    resources: ['https://api.yourapp.com'],
    routing: {
      callbackPath: '/auth/callback',
      signedOutPath: '/auth/signed-out',
      primaryResource: 'https://api.yourapp.com',
      secureRoutes: [
        {resource: 'https://api.yourapp.com', routes: ['/api']},
      ],
    },
  } satisfies LogtoAuthConfig,
};
```

---

## Configuration reference

### `LogtoAuthConfig`

Extends `@logto/browser`'s native `LogtoConfig` with two extra fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `endpoint` | `string` | Yes | Your Logto tenant URL. |
| `appId` | `string` | Yes | Application ID from the Logto console. |
| `scopes` | `string[]` | No | OIDC scopes to request. |
| `resources` | `string[]` | No | API resource indicators registered in Logto. |
| `routing` | `LogtoRoutingConfig` | Yes | Angular routing/behavior addon (see below). |
| `noAccessMessage` | `string` | No | Error shown when the user authenticates but has no scopes on the primary resource. |

### `LogtoRoutingConfig`

| Field | Type | Required | Description |
|---|---|---|---|
| `callbackPath` | `string` | Yes | Path Logto redirects to after sign-in (e.g. `/auth/callback`). |
| `signedOutPath` | `string` | Yes | Path shown after sign-out (e.g. `/auth/signed-out`). |
| `primaryResource` | `string` | No | The primary API resource indicator. Defaults to the first `secureRoutes` resource. Used for the scope-access gate in `CallbackComponent` and by consumers that need a specific resource token. |
| `secureRoutes` | `SecureRouteMapping[]` | Yes | Maps request URLs to resource tokens for the HTTP interceptor. |

### `SecureRouteMapping`

| Field | Type | Description |
|---|---|---|
| `resource` | `string` | Logto API resource indicator to fetch a token for. |
| `routes` | `string[]` | Request URL prefixes (matched with `startsWith`) that require this resource's token. |

### `LogtoAuthOptions`

Passed to `provideLogtoAuth()`. Extends `LogtoAuthConfig` with:

| Field | Type | Description |
|---|---|---|
| `logoutHookFactories` | `Array<() => AuthLogoutHook>` | Factories that run inside an injection context and return a hook to call at logout time. |

---

## Feature guide

### `AuthService`

A singleton service (provided in root) that owns the authenticated state and all Logto operations.

```ts
import {AuthService} from '@ratespecial/logto-angular';

@Component({...})
export class MyComponent {
  private auth = inject(AuthService);

  constructor() {
    // Subscribe to auth state changes
    this.auth.isAuthenticated$.subscribe(authenticated => {
      console.log('authenticated?', authenticated);
    });
  }
}
```

**Public API:**

| Method/Property | Return | Description |
|---|---|---|
| `isAuthenticated$` | `Observable<boolean>` | Replay-current stream; `distinctUntilChanged`. |
| `refreshAuthState()` | `Promise<boolean>` | Reads session from storage (no network); pushes result to stream. |
| `signIn(redirectUri?)` | `void` | Full-page redirect to Logto hosted UI. Default redirect URI is built from `callbackPath`. |
| `handleCallback(callbackUri)` | `Promise<void>` | Complete the OIDC callback, then refresh auth state. |
| `getAccessToken(resource?)` | `Promise<string>` | Resource-scoped JWT; client refreshes/caches transparently. |
| `getAccessTokenClaims(resource?)` | `Promise<AccessTokenClaims>` | Decoded claims of the resource token (e.g. `scope`). |
| `getIdTokenClaims()` | `Promise<IdTokenClaims>` | Decoded claims of the ID token (e.g. `sub`, `name`, `email`). |
| `logout()` | `void` | Fires hooks, emits `false`, calls `signOut`, navigates to `signedOutPath` on error. |

### `authGuard`

A functional `CanActivateFn` that checks for an active Logto session and redirects to the login flow when absent.

**Behavior:**

1. Calls `AuthService.refreshAuthState()`.
2. If authenticated, returns `true` (allows navigation).
3. If not authenticated:
   - Saves the attempted URL via `HistoryService.setLastVisitedRoute()` (skipped for `/auth/*` paths to avoid loops).
   - Calls `AuthService.signIn()` (full-page redirect).
   - Returns `false`.

After sign-in, `CallbackComponent` restores navigation to the saved URL via `HistoryService.consumeLastVisitedRoute()`.

```ts
// app.routes.ts
{
  path: 'dashboard',
  canActivate: [authGuard],
  loadComponent: () => import('./dashboard/dashboard.component'),
},
```

### `logtoTokenInterceptor`

Attaches a resource-scoped `Bearer` token to outgoing HTTP requests that match a configured route prefix.

**How it works:**

- Reads `LOGTO_AUTH_CONFIG.routing.secureRoutes` at intercept time.
- Calls `resourceForUrl(req.url, secureRoutes)` to find the first mapping whose `routes` entry matches the request URL via `startsWith`.
- If a resource matches, calls `AuthService.getAccessToken(resource)` (the Logto SDK refreshes/caches the token).
- Adds `Authorization: Bearer <token>` and forwards the cloned request.
- If no resource matches, or the token is empty, the request passes through unchanged.

**Using `resourceForUrl` standalone:**

```ts
import {resourceForUrl} from '@ratespecial/logto-angular';

const resource = resourceForUrl('/api/v2/users', secureRoutes);
// 'https://api.yourapp.com' (or undefined)
```

**Multi-resource example:**

```ts
routing: {
  secureRoutes: [
    {resource: 'https://api.yourapp.com',      routes: ['/api']},
    {resource: 'https://billing.yourapp.com',  routes: ['/billing', '/payments']},
  ],
}
```

Requests to `/api/...` get a token for `https://api.yourapp.com`; requests to `/billing/...` or `/payments/...` get a token for `https://billing.yourapp.com`.

### `logoutOnUnauthInterceptor`

Calls `AuthService.logout()` whenever any HTTP response returns `401 Unauthorized`.

```ts
provideHttpClient(
  withInterceptors([logtoTokenInterceptor, logoutOnUnauthInterceptor]),
),
```

Order matters: place `logtoTokenInterceptor` first so the token is attached before the response interceptor evaluates it.

### `CallbackComponent` and `SignedOutComponent`

These are registered automatically by `getAuthRoutes()`:

- **`CallbackComponent`** (`lib-callback`): Handles the OIDC redirect. Calls `handleCallback`, checks that the primary resource token carries scopes (access gate), then navigates to the restored route or `/`. Displays a spinner while loading and an error message on failure or no-access.
- **`SignedOutComponent`** (`lib-signed-out`): Shows a "Signed out" card with a "Sign in again" button that restarts the Logto flow.

Both use `ChangeDetectionStrategy.OnPush` and signals.

### `HistoryService`

Persists the last visited route in `sessionStorage` across the OIDC redirect round-trip.

```ts
import {HistoryService} from '@ratespecial/logto-angular';

@Injectable({providedIn: 'root'})
export class MyService {
  private history = inject(HistoryService);
}
```

| Method | Description |
|---|---|
| `setLastVisitedRoute(route)` | Writes to `sessionStorage` (key: `auth.lastVisitedRoute`). |
| `getLastVisitedRoute()` | Reads from `sessionStorage`; returns `null` if absent. |
| `clearLastVisitedRoute()` | Removes the stored value. |
| `consumeLastVisitedRoute()` | Reads then clears in one call. Used by `CallbackComponent`. |

All methods swallow `sessionStorage` errors (e.g. quota exceeded) and log them to `console.error`.

### `initializeRouteTracking`

An `APP_INITIALIZER` factory that subscribes to `Router.events` and records each non-auth route via `HistoryService`. Routes starting with `/auth` are excluded to prevent redirect loops.

```ts
import {provideAppInitializer} from '@angular/core';
import {initializeRouteTracking} from '@ratespecial/logto-angular';

providers: [
  provideAppInitializer(initializeRouteTracking()),,
]
```

### Logout hooks

Register side-effects that run at the start of `AuthService.logout()` before the sign-out redirect. Common uses: clearing NGXS/NgRx state, flushing caches, firing telemetry events.

Each factory receives an injection context (DI works inside it), and returns an `AuthLogoutHook` — a function that returns `void` or `Observable<unknown>`. Async hooks are fire-and-forget.

**Via `provideLogtoAuth` (recommended):**

```ts
provideLogtoAuth({
  ...environment.logto,
  logoutHookFactories: [
    () => {
      const store = inject(Store); // inject() works here
      return () => store.dispatch(new ClearState()); // returns Observable
    },
    () => {
      const cache = inject(CacheService);
      return () => cache.clear(); // returns void
    },
  ],
})
```

**Direct token registration (advanced):**

```ts
{provide: AUTH_LOGOUT_HOOK, multi: true, useFactory: () => {
  const store = inject(Store);
  return () => store.dispatch(new ClearState());
}}
```

### Injection tokens

| Token | Type | Provided by | Consumed by |
|---|---|---|---|
| `LOGTO_AUTH_CONFIG` | `LogtoAuthConfig` | `provideLogtoAuth()` | `AuthService`, `logtoTokenInterceptor`, `CallbackComponent` |
| `LOGTO_CLIENT` | `LogtoClient` | `provideLogtoAuth()` | `AuthService` |
| `PRIMARY_RESOURCE` | `string` | `provideLogtoAuth()` | `CallbackComponent`, app components needing a specific token |
| `AUTH_LOGOUT_HOOK` | `AuthLogoutHook[]` | `provideLogtoAuth()` (multi) | `AuthService.logout()` |

---

## Testing

Use `provideLogtoTesting()` from the secondary entry point to inject test doubles without a real Logto setup.

```ts
import {provideLogtoTesting} from '@ratespecial/logto-angular/testing';
```

**Default behaviour:** the stub client always returns unauthenticated with an empty access token and empty scope claims. The default config uses `https://api.example.test` as the primary resource.

**Basic usage:**

```ts
TestBed.configureTestingModule({
  providers: [
    ...provideLogtoTesting(),
    MyComponent,
  ],
});
```

**Override client methods:**

```ts
TestBed.configureTestingModule({
  providers: [
    ...provideLogtoTesting({
      isAuthenticated: async () => true,
      getAccessToken: async () => 'my-test-token',
      getAccessTokenClaims: async () => ({scope: 'read write'}),
    }),
  ],
});
```

**Override config:**

```ts
TestBed.configureTestingModule({
  providers: [
    ...provideLogtoTesting(
      {}, // no client overrides
      {
        noAccessMessage: 'Custom access-denied message.',
        routing: {
          callbackPath: '/custom/callback',
          signedOutPath: '/custom/signed-out',
          primaryResource: 'https://api.custom.test',
          secureRoutes: [{resource: 'https://api.custom.test', routes: ['/api']}],
        },
      },
    ),
  ],
});
```

---

## Building and local linking

### Build the library

```bash
# From the logto-angular workspace root
ng build logto-angular
```

Output is emitted to `dist/logto-angular` (with `dist/logto-angular/testing` for the secondary entry point).

### Link to a consuming app (Yarn `file:`)

Use Yarn's `file:` protocol — **not** `portal:` or `link:` — to reference the built dist.

In the consuming app's `package.json`:

```json
{
  "dependencies": {
    "@ratespecial/logto-angular": "file:../../logto-angular/dist/logto-angular"
  }
}
```

Then install:

```bash
yarn install
```

**Why `file:` and not `portal:`?**

`portal:` creates a symlink whose *real* path still sits inside the `logto-angular` workspace. Node.js and esbuild follow the symlink back to the real location, then walk up the directory tree and find `/home/fish/logto-angular/node_modules/@angular` — a second Angular instance alongside the consumer's own. This causes `NG0203` injection errors at runtime and structural type-incompatibility errors at compile time (the two Angular copies produce distinct class definitions even at the same version).

`file:` snapshots the dist as a real directory copy under the consumer's `node_modules`. Peer-dependency resolution then finds only the consumer's single Angular, eliminating the dual-instance problem entirely.

**After each library rebuild, re-run `yarn install` in the consumer** to pick up the latest dist snapshot — `file:` does not live-update the way a symlink does:

```bash
# Terminal 1 — rebuild library
ng build logto-angular

# Terminal 2 — re-snapshot in consumer
yarn install   # or: yarn up @ratespecial/logto-angular
```

**Belt-and-suspenders: `preserveSymlinks`**

Add `preserveSymlinks: true` to the consumer's Angular build target in `angular.json` and to its `tsconfig.json` `compilerOptions`. This prevents the Angular compiler from canonicalizing any remaining symlinks and ensures module resolution stays within the consumer's `node_modules`:

```json
// angular.json — inside the build target's options
{
  "preserveSymlinks": true
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "preserveSymlinks": true
  }
}
```

### Run tests

```bash
ng test
```

### Publish

Update `version` in `projects/logto-angular/package.json`, then:

```bash
ng build logto-angular
npm publish dist/logto-angular --access public
```
