import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import LogtoClient from '@logto/browser';
import { AuthService } from './auth.service';
import { LogtoAuthConfig } from './logto.config';
import {
  AUTH_LOGOUT_HOOK,
  AuthLogoutHook,
  LOGTO_AUTH_CONFIG,
  LOGTO_CLIENT,
  PRIMARY_RESOURCE,
} from './tokens';

/**
 * Configuration passed to `provideLogtoAuth()`: the native `LogtoConfig` fields plus the
 * `routing` addon, with optional logout hooks.
 */
export interface LogtoAuthOptions extends LogtoAuthConfig {
  /**
   * Factories that produce `AuthLogoutHook` callbacks. Each factory runs inside an injection
   * context, so it may use `inject()` to obtain app services (e.g. an NGXS `Store`) when
   * building its hook. The hooks run at the start of `AuthService.logout()`.
   *
   * @example
   * ```ts
   * logoutHookFactories: [
   *   () => {
   *     const store = inject(Store);
   *     return () => store.dispatch(new ClearState());
   *   },
   * ]
   * ```
   */
  logoutHookFactories?: Array<() => AuthLogoutHook>;
}

/**
 * Wires up the auth library: provides the resolved config, constructs the single
 * `@logto/browser` client, resolves the primary resource, contributes any
 * `logoutHookFactories` to the `AUTH_LOGOUT_HOOK` multi-provider, and hydrates the
 * authenticated-state signal from any existing session before the first guard runs.
 *
 * Returned providers are environment-scoped — call this once at the root provider list.
 *
 * @example
 * ```ts
 * providers: [
 *   provideLogtoAuth({
 *     ...environment.logto,
 *     logoutHookFactories: [
 *       () => {
 *         const store = inject(Store);
 *         return () => store.dispatch(new ClearState());
 *       },
 *     ],
 *   }),
 * ]
 * ```
 */
export function provideLogtoAuth(options: LogtoAuthOptions): EnvironmentProviders {
  const { logoutHookFactories, ...config } = options;

  const hookProviders = (logoutHookFactories ?? []).map((factory) => ({
    provide: AUTH_LOGOUT_HOOK,
    multi: true,
    useFactory: factory,
  }));

  // `routing` and `noAccessMessage` are app-only concerns; strip them so only the native
  // `LogtoConfig` reaches the SDK.
  const { routing: _routing, noAccessMessage: _noAccessMessage, ...logtoConfig } = config;

  return makeEnvironmentProviders([
    { provide: LOGTO_AUTH_CONFIG, useValue: config },
    { provide: LOGTO_CLIENT, useValue: new LogtoClient(logtoConfig) },
    {
      provide: PRIMARY_RESOURCE,
      useValue: config.routing.primaryResource ?? config.routing.secureRoutes[0].resource,
    },

    ...hookProviders,

    // Hydrate the authenticated-state signal from any existing session before the first guard runs.
    provideAppInitializer(() => {
      void inject(AuthService).refreshAuthState();
    }),
  ]);
}
