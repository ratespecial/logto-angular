import { Provider } from '@angular/core';
import type LogtoClient from '@logto/browser';
import type { LogtoAuthConfig } from '@ratespecial/logto-angular';
import { LOGTO_AUTH_CONFIG, LOGTO_CLIENT, PRIMARY_RESOURCE } from '@ratespecial/logto-angular';

const DEFAULT_PRIMARY_RESOURCE = 'https://api.example.test';

const DEFAULT_TEST_CONFIG: LogtoAuthConfig = {
  endpoint: 'https://test.logto.app',
  appId: 'test-app',
  routing: {
    callbackPath: '/auth/callback',
    signedOutPath: '/auth/signed-out',
    primaryResource: DEFAULT_PRIMARY_RESOURCE,
    secureRoutes: [{ resource: DEFAULT_PRIMARY_RESOURCE, routes: ['/api'] }],
  },
};

/**
 * Test doubles for the auth layer. Provides a no-op `LogtoClient` (unauthenticated by default)
 * plus the `LOGTO_AUTH_CONFIG` / `PRIMARY_RESOURCE` tokens that `AuthService` and the auth
 * components depend on, so components under test can inject them without a real Logto setup.
 *
 * @param clientOverrides - Partial `LogtoClient` methods to override on the stub.
 * @param configOverrides - Partial `LogtoAuthConfig` fields to override on the default test config.
 */
export function provideLogtoTesting(
  clientOverrides: Partial<LogtoClient> = {},
  configOverrides: Partial<LogtoAuthConfig> = {},
): Provider[] {
  const config: LogtoAuthConfig = { ...DEFAULT_TEST_CONFIG, ...configOverrides };
  const primaryResource =
    config.routing.primaryResource ??
    config.routing.secureRoutes[0]?.resource ??
    DEFAULT_PRIMARY_RESOURCE;

  const stub = {
    isAuthenticated: async () => false,
    getAccessToken: async () => '',
    getAccessTokenClaims: async () => ({ scope: '' }),
    getIdTokenClaims: async () => ({}),
    signIn: async () => undefined,
    signOut: async () => undefined,
    handleSignInCallback: async () => undefined,
    ...clientOverrides,
  } as unknown as LogtoClient;

  return [
    { provide: LOGTO_CLIENT, useValue: stub },
    { provide: LOGTO_AUTH_CONFIG, useValue: config },
    { provide: PRIMARY_RESOURCE, useValue: primaryResource },
  ];
}
