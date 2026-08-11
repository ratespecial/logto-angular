import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../auth.service';
import { HistoryService } from '../history.service';
import { PRIMARY_RESOURCE } from '../tokens';

/**
 * Replaces `autoLoginPartialRoutesGuard`. Allows activation when a Logto session
 * exists; otherwise records the attempted route and kicks off a sign-in redirect.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const history = inject(HistoryService);
  const primaryResource = inject(PRIMARY_RESOURCE);

  if (await auth.refreshAuthState()) {
    // A stored ID token only proves a session once existed — `@logto/browser` never checks
    // its expiry. Fetching the primary resource token is what proves the session is still
    // alive. A dead one self-heals inside `AuthService`, which leaves this call pending while
    // the browser redirects to Logto, so navigation simply never completes.
    try {
      await auth.getAccessToken(primaryResource);
      return true;
    } catch (err: unknown) {
      // Only transient failures (offline, Logto unreachable) land here, and they say nothing
      // about session validity. Let the user in rather than stranding them on a blank screen;
      // individual requests will surface their own errors.
      console.error(err);
      return true;
    }
  }

  if (!state.url.startsWith('/auth')) {
    history.setLastVisitedRoute(state.url);
  }
  auth.signIn();
  return false;
};
