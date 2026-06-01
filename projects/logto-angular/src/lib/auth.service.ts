import {inject, Injectable} from '@angular/core';
import {Router} from '@angular/router';
import type {AccessTokenClaims, IdTokenClaims} from '@logto/browser';
import {BehaviorSubject, isObservable, Observable} from 'rxjs';
import {distinctUntilChanged} from 'rxjs/operators';
import {AUTH_LOGOUT_HOOK, LOGTO_AUTH_CONFIG, LOGTO_CLIENT} from './tokens';

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
  private logoutHooks = inject(AUTH_LOGOUT_HOOK, {optional: true}) ?? [];

  private authenticated$ = new BehaviorSubject(false);

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

  /** Begin a sign-in flow with Logto (full-page redirect to the hosted UI). */
  signIn(redirectUri: string = window.location.origin + this.routing.callbackPath): void {
    void this.client.signIn(redirectUri);
  }

  /** Complete the OAuth callback, then refresh local auth state. */
  async handleCallback(callbackUri: string): Promise<void> {
    await this.client.handleSignInCallback(callbackUri);
    await this.refreshAuthState();
  }

  /**
   * Fetch a resource-scoped JWT. The client refreshes/caches transparently, so this is safe to
   * call on every request. Omit `resource` for an opaque (userinfo) token.
   */
  getAccessToken(resource?: string): Promise<string> {
    return this.client.getAccessToken(resource);
  }

  /** Decoded claims of the resource-scoped access token (e.g. to inspect `scope`). */
  getAccessTokenClaims(resource?: string): Promise<AccessTokenClaims> {
    return this.client.getAccessTokenClaims(resource);
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
    this.client
      .signOut(window.location.origin + signedOutPath)
      .catch((err: unknown) => {
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
        result.subscribe({error: (err) => console.error(err)});
      }
    }
  }
}
