import {Routes} from '@angular/router';
import {CallbackComponent} from './callback/callback.component';
import {SignedOutComponent} from './signed-out/signed-out.component';
import {LogtoRoutingConfig} from './logto.config';

/** Routes accept a path relative to the app root, so drop any leading slash. */
function toRoutePath(path: string): string {
  return path.replace(/^\//, '');
}

/**
 * Returns the auth routes (callback + signed-out landing) for the configured paths. Spread the
 * result into the app's top-level `Routes`. Passing the same `routing` config used by
 * `provideLogtoAuth()` keeps the route definitions and the redirect URIs from drifting apart.
 *
 * @example
 * ```ts
 * export const routes: Routes = [
 *   {path: '', pathMatch: 'full', redirectTo: '/dashboard'},
 *   ...getAuthRoutes(environment.logto.routing),
 *   // ...app routes
 * ];
 * ```
 */
export function getAuthRoutes(routing: Pick<LogtoRoutingConfig, 'callbackPath' | 'signedOutPath'>): Routes {
  return [
    {path: toRoutePath(routing.callbackPath), component: CallbackComponent},
    {path: toRoutePath(routing.signedOutPath), component: SignedOutComponent},
  ];
}
