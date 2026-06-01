import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLogtoAuth } from './provide-auth';
import type { AuthLogoutHook } from './tokens';
import { AUTH_LOGOUT_HOOK, LOGTO_AUTH_CONFIG, LOGTO_CLIENT, PRIMARY_RESOURCE } from './tokens';
import type { LogtoAuthConfig } from './logto.config';

const PRIMARY = 'https://api.example.test';
const SECONDARY = 'https://billing.example.test';

const BASE_OPTIONS: LogtoAuthConfig & { logoutHookFactories?: (() => AuthLogoutHook)[] } = {
  endpoint: 'https://test.logto.app',
  appId: 'test-app',
  routing: {
    callbackPath: '/auth/callback',
    signedOutPath: '/auth/signed-out',
    primaryResource: PRIMARY,
    secureRoutes: [{ resource: PRIMARY, routes: ['/api'] }],
  },
};

describe('provideLogtoAuth', () => {
  function setup(options = BASE_OPTIONS) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideLogtoAuth(options)],
    });
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('provides LOGTO_AUTH_CONFIG with the supplied config', () => {
    setup();
    const config = TestBed.inject(LOGTO_AUTH_CONFIG);
    expect(config.appId).toBe('test-app');
    expect(config.routing.callbackPath).toBe('/auth/callback');
  });

  it('provides LOGTO_CLIENT as a LogtoClient instance', () => {
    setup();
    const client = TestBed.inject(LOGTO_CLIENT);
    expect(client).toBeDefined();
  });

  it('provides PRIMARY_RESOURCE from routing.primaryResource', () => {
    setup();
    const primary = TestBed.inject(PRIMARY_RESOURCE);
    expect(primary).toBe(PRIMARY);
  });

  it('falls back to first secureRoute resource when primaryResource is omitted', () => {
    const options = {
      ...BASE_OPTIONS,
      routing: {
        ...BASE_OPTIONS.routing,
        primaryResource: undefined,
        secureRoutes: [{ resource: SECONDARY, routes: ['/billing'] }],
      },
    };
    setup(options as LogtoAuthConfig);
    const primary = TestBed.inject(PRIMARY_RESOURCE);
    expect(primary).toBe(SECONDARY);
  });

  it('registers logoutHookFactories as multi AUTH_LOGOUT_HOOK providers', () => {
    const hookA = vi.fn();
    const hookB = vi.fn();

    setup({
      ...BASE_OPTIONS,
      logoutHookFactories: [() => hookA, () => hookB],
    });

    const hooks = TestBed.inject(AUTH_LOGOUT_HOOK, null);
    expect(hooks).not.toBeNull();
    expect(hooks!.length).toBe(2);
  });

  it('works without logoutHookFactories (no AUTH_LOGOUT_HOOK provided)', () => {
    setup(BASE_OPTIONS);
    // Should not throw; optional inject returns null when no hook is registered.
    const hooks = TestBed.inject(AUTH_LOGOUT_HOOK, null);
    // The token is multi: false by default when none registered; null or empty array accepted.
    expect(hooks == null || Array.isArray(hooks)).toBe(true);
  });
});
