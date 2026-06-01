import type { LogtoConfig } from '@logto/browser';

/**
 * Maps outgoing request URLs to the Logto API resource whose access token the HTTP
 * interceptor should attach. This is the one piece `@logto/browser` does not model —
 * the SDK issues per-resource tokens but has no concept of which requests need them.
 */
export interface SecureRouteMapping {
  /** Logto API resource indicator to fetch a token for. */
  resource: string;

  /** Request URL prefixes (matched with `startsWith`) that require this resource's token. */
  routes: string[];
}

/**
 * App-level routing/behavior config that sits alongside the native `LogtoConfig`.
 */
export interface LogtoRoutingConfig {
  /** Path Logto redirects back to after sign-in. Used by `signIn()` and the route helper. */
  callbackPath: string;

  /** Path shown after sign-out. Used by `logout()` and the route helper. */
  signedOutPath: string;

  /**
   * The primary API resource — used where a specific resource token is needed outside the
   * interceptor (e.g. the Echo/Pusher auth header) and for the post-callback access gate.
   * Defaults to the first `secureRoutes` resource when omitted.
   */
  primaryResource?: string;

  /** Maps request URLs to the resource token the interceptor attaches. */
  secureRoutes: SecureRouteMapping[];
}

/**
 * Full auth configuration: `@logto/browser`'s native `LogtoConfig` (endpoint, appId,
 * scopes, resources, prompt, …) plus the app-level `routing` addon this library needs.
 * Provided app-wide under the `LOGTO_AUTH_CONFIG` token.
 */
export interface LogtoAuthConfig extends LogtoConfig {
  routing: LogtoRoutingConfig;

  /** Message shown when an authenticated user has no scopes on the primary resource. */
  noAccessMessage?: string;
}
