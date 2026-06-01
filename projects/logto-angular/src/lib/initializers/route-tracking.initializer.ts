import { inject } from '@angular/core';
import { Router, RoutesRecognized } from '@angular/router';
import { filter } from 'rxjs/operators';
import { HistoryService } from '../history.service';

/**
 * Initializer that tracks the last visited route.
 * Excludes auth routes (/auth/*) to prevent redirect loops.
 */
export function initializeRouteTracking() {
  return () => {
    const router = inject(Router);
    const historyService = inject(HistoryService);

    router.events
      .pipe(filter((event) => event instanceof RoutesRecognized))
      .subscribe((event: RoutesRecognized) => {
        if (!event.urlAfterRedirects.startsWith('/auth')) {
          historyService.setLastVisitedRoute(event.urlAfterRedirects);
        }
      });
  };
}
