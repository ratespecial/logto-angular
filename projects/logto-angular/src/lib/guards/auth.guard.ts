import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../auth.service';
import { HistoryService } from '../history.service';

/**
 * Replaces `autoLoginPartialRoutesGuard`. Allows activation when a Logto session
 * exists; otherwise records the attempted route and kicks off a sign-in redirect.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const history = inject(HistoryService);

  if (await auth.refreshAuthState()) {
    return true;
  }

  if (!state.url.startsWith('/auth')) {
    history.setLastVisitedRoute(state.url);
  }
  auth.signIn();
  return false;
};
