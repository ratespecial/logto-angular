import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import type { AccessTokenClaims, IdTokenClaims } from '@logto/browser';
import { BehaviorSubject, isObservable, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { isDeadSessionError } from './auth-errors';
import { HistoryService } from './history.service';
import { AUTH_LOGOUT_HOOK, LOGTO_AUTH_CONFIG, LOGTO_CLIENT } from './tokens';

/**
 * sessionStorage key holding the timestamp of the last dead-session recovery. Guards
 * against an infinite app → Logto → callback → app redirect loop if the fresh session
 * is *also* rejected (e.g. the resource was removed from the Logto app).
 */
const RECOVERY_MARKER_KEY = 'auth.lastRecoveryAt';

/** How long after a recovery a second one is suppressed. */
const RECOVERY_COOLDOWN_MS = 30_000;

/**
 * Angular-friendly facade over the promise-based `@logto/browser` client. Owns the
 * authenticated-state signal, sign-in/out, and resource-scoped token access.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  private client = inject(LOGTO_CLIENT);
  private routing = inject(LOGTO_AUTH_CONFIG).routing;
  private history = inject(HistoryService);
  private logoutHooks = inject(AUTH_LOGOUT_HOOK, { optional: true }) ?? [];

  private authenticated$ = new BehaviorSubject(false);

  /** The in-flight recovery redirect, shared by every request that failed alongside it. */
  private recovery: Promise<void> | null = null;

  /** Whether recovery has already been evaluated, so a declined one is not reconsidered. */
  private recoveryConsidered = false;

  /**
   * Authenticated state as a stream. Backed by a `BehaviorSubject`, so it replays the current
   * value on subscribe (order-independent for late subscribers) and only emits on change.
   */
  readonly isAuthenticated$: Observable<boolean> = this.authenticated$.pipe(distinctUntilChanged());

  /**
   * Re-reads the client's authenticated state (checks for a stored session; no network) and
   * pushes it to the stream. Returns the resolved value.
   */
  async refreshAuthState(): Promise<boolean> {
    const authenticated = await this.client.isAuthenticated();
    this.authenticated$.next(authenticated);
    return authenticated;
  }

  /**
   * Begin a sign-in flow with Logto (full-page redirect to the hosted UI). The SDK clears
   * every stored token before navigating, so this doubles as a session flush.
   */
  signIn(redirectUri: string = window.location.origin + this.routing.callbackPath): void {
    void this.startSignIn(redirectUri);
  }

  /** Complete the OAuth callback, then refresh local auth state. */
  async handleCallback(callbackUri: string): Promise<void> {
    await this.client.handleSignInCallback(callbackUri);
    await this.refreshAuthState();
  }

  /**
   * Fetch a resource-scoped JWT. The client refreshes/caches transparently, so this is safe to
   * call on every request. Omit `resource` for an opaque (userinfo) token.
   *
   * A dead session (expired/revoked/missing refresh token) triggers
   * {@link recoverDeadSession}; see there for what the returned promise does.
   */
  getAccessToken(resource?: string): Promise<string> {
    return this.withDeadSessionRecovery(() => this.client.getAccessToken(resource));
  }

  /** Decoded claims of the resource-scoped access token (e.g. to inspect `scope`). */
  getAccessTokenClaims(resource?: string): Promise<AccessTokenClaims> {
    return this.withDeadSessionRecovery(() => this.client.getAccessTokenClaims(resource));
  }

  /**
   * Flush an unusable session and immediately start a fresh sign-in.
   *
   * `@logto/browser` treats "a stored ID token exists" as "signed in" and never clears the
   * tokens it has just proved dead, so without this a stale session wedges the app: the
   * guard lets the user in, then every token fetch rejects forever. `client.signIn()`
   * clears all stored tokens before redirecting, so the flush and the retry are one step.
   *
   * Deliberately not `logout()` — that round-trips the end-session endpoint and strands the
   * user on the signed-out page, when in practice the Logto SSO cookie usually re-authorizes
   * silently.
   *
   * Safe to call repeatedly: concurrent failures all receive the same in-flight redirect.
   *
   * @returns the in-flight sign-in redirect, or `null` when recovery was declined (on an auth
   * route, or within the cooldown).
   */
  recoverDeadSession(): Promise<void> | null {
    if (this.recoveryConsidered) {
      return this.recovery;
    }
    this.recoveryConsidered = true;

    const url = this.router.url;

    // The auth pages own their own error/recovery UI; redirecting from them risks a loop.
    if (this.isAuthRoute(url)) {
      return null;
    }

    if (this.isRecoveryOnCooldown()) {
      console.error(
        'Logto session recovery already attempted recently; not retrying. The session may be misconfigured.',
      );
      return null;
    }
    this.markRecoveryAttempt();

    // `initializeRouteTracking` records the intended route on `RoutesRecognized`, which is
    // more accurate than `router.url` — during the first navigation the router has not
    // committed the new URL yet, so `router.url` is still the previous (or root) route. Only
    // fall back to it when nothing has been recorded.
    if (!this.history.getLastVisitedRoute()) {
      this.history.setLastVisitedRoute(url);
    }

    this.fireLogoutHooks();
    this.authenticated$.next(false);
    this.recovery = this.startSignIn(window.location.origin + this.routing.callbackPath);

    return this.recovery;
  }

  /**
   * Decoded claims of the ID token (e.g. `sub`, `name`, `email`, `picture`). Reads the token
   * already in storage and decodes it locally — no network call.
   */
  getIdTokenClaims(): Promise<IdTokenClaims> {
    return this.client.getIdTokenClaims();
  }

  /** Sign out via Logto and reset local state. */
  logout(): void {
    this.fireLogoutHooks();

    this.authenticated$.next(false);

    const signedOutPath = this.routing.signedOutPath;
    this.client.signOut(window.location.origin + signedOutPath).catch((err: unknown) => {
      console.error(err);

      if (this.router.url !== signedOutPath) {
        this.router.navigateByUrl(signedOutPath);
      }
    });
  }

  protected fireLogoutHooks(): void {
    for (const hook of this.logoutHooks) {
      const result = hook();

      if (isObservable(result)) {
        result.subscribe({ error: (err) => console.error(err) });
      }
    }
  }

  /** Starts the redirect, logging (rather than leaking) a failure to reach Logto. */
  private startSignIn(redirectUri: string): Promise<void> {
    const redirect = this.client.signIn(redirectUri);
    redirect.catch((err: unknown) => console.error(err));

    return redirect;
  }

  /**
   * Runs a token operation, self-healing a dead session.
   *
   * When recovery starts a redirect the returned promise is left pending on purpose: the page
   * is on its way to Logto, so the call has no answer to wait for, and settling it would only
   * push an error every caller would have to catch — including the ones that legitimately
   * ignore failures. Callers simply never resume before the browser unloads. If the redirect
   * itself fails, the promise rejects with the original error so the problem is still visible.
   */
  private async withDeadSessionRecovery<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (err: unknown) {
      if (!isDeadSessionError(err)) {
        throw err;
      }

      const redirect = this.recoverDeadSession();

      if (!redirect) {
        throw err;
      }

      return new Promise<T>((_resolve, reject) => {
        redirect.catch(() => reject(err));
      });
    }
  }

  private isAuthRoute(url: string): boolean {
    return url.startsWith(this.routing.callbackPath) || url.startsWith(this.routing.signedOutPath);
  }

  private isRecoveryOnCooldown(): boolean {
    try {
      const attemptedAt = Number(sessionStorage.getItem(RECOVERY_MARKER_KEY));

      return Boolean(attemptedAt) && Date.now() - attemptedAt < RECOVERY_COOLDOWN_MS;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  private markRecoveryAttempt(): void {
    try {
      sessionStorage.setItem(RECOVERY_MARKER_KEY, String(Date.now()));
    } catch (err) {
      console.error(err);
    }
  }
}
