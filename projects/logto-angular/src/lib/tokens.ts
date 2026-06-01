import { InjectionToken } from '@angular/core';
import type LogtoClient from '@logto/browser';
import { Observable } from 'rxjs';
import { LogtoAuthConfig } from './logto.config';

/**
 * The resolved auth configuration (native Logto config + `routing` addon). Every part of
 * the library reads from this token, so nothing depends on the consuming app's environment.
 */
export const LOGTO_AUTH_CONFIG = new InjectionToken<LogtoAuthConfig>('LOGTO_AUTH_CONFIG');

/**
 * The single, app-wide `@logto/browser` client. One client handles every resource:
 * `getAccessToken(resource)` exchanges the shared refresh token for a resource-scoped JWT
 * on demand and caches it.
 */
export const LOGTO_CLIENT = new InjectionToken<LogtoClient>('LOGTO_CLIENT');

/**
 * The primary API resource (`routing.primaryResource`, or the first secure-route resource).
 * Used where a specific resource token is needed outside the HTTP interceptor — e.g. the
 * Echo/Pusher auth header and the post-callback access gate.
 */
export const PRIMARY_RESOURCE = new InjectionToken<string>('PRIMARY_RESOURCE');

/**
 * A side-effect callback the library runs at the start of `AuthService.logout()`, before the
 * sign-out redirect. Use for app teardown such as clearing client-side state or flushing caches.
 *
 * Return `void` for synchronous work or an `Observable` for async work. Async hooks are
 * fire-and-forget — the library does not wait for them before logging the user off.
 */
export type AuthLogoutHook = () => void | Observable<unknown>;

/**
 * Multi-provider token that collects `AuthLogoutHook` callbacks invoked during logout.
 *
 * Ordering between hooks follows Angular DI registration order. Register one hook per concern
 * (state reset, cache flush, telemetry, …) rather than bundling them.
 *
 * Prefer registering hooks via `provideLogtoAuth({ logoutHookFactories: [...] })` over wiring
 * this token directly — the factory form runs inside an injection context so the hook can
 * use `inject()`.
 *
 * @example
 * ```ts
 * provideLogtoAuth({
 *   endpoint: environment.logto.endpoint,
 *   appId: environment.logto.appId,
 *   routing: environment.logto.routing,
 *   logoutHookFactories: [
 *     () => {
 *       const store = inject(Store);
 *       return () => store.dispatch(new ClearState());
 *     },
 *   ],
 * })
 * ```
 */
export const AUTH_LOGOUT_HOOK = new InjectionToken<AuthLogoutHook[]>('AUTH_LOGOUT_HOOK');
