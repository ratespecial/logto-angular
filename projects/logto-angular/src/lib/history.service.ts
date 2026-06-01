import {Injectable} from '@angular/core';

/**
 * sessionStorage key used to persist the last visited app route across the OIDC
 * redirect round-trip. Scoped to the browser session (cleared on tab close) and
 * namespaced under `auth.` to avoid collision with unrelated app state.
 */
const STORAGE_KEY = 'auth.lastVisitedRoute';

/**
 * Facade for tracking the last visited route, used to restore navigation after login.
 * Backed by sessionStorage so the value is scoped to the browser session.
 */
@Injectable({
  providedIn: 'root',
})
export class HistoryService {
  setLastVisitedRoute(route: string): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, route);
    } catch (err) {
      console.error(err);
    }
  }

  getLastVisitedRoute(): string | null {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  clearLastVisitedRoute(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error(err);
    }
  }

  consumeLastVisitedRoute(): string | null {
    const url = this.getLastVisitedRoute();
    this.clearLastVisitedRoute();
    return url;
  }
}
