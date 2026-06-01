import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { AUTH_LOGOUT_HOOK, LOGTO_AUTH_CONFIG, LOGTO_CLIENT } from './tokens';
import type { LogtoAuthConfig } from './logto.config';

const PRIMARY = 'https://api.example.test';

const TEST_CONFIG: LogtoAuthConfig = {
  endpoint: 'https://test.logto.app',
  appId: 'test-app',
  routing: {
    callbackPath: '/auth/callback',
    signedOutPath: '/auth/signed-out',
    primaryResource: PRIMARY,
    secureRoutes: [{ resource: PRIMARY, routes: ['/api'] }],
  },
};

function makeClientStub(overrides: Record<string, unknown> = {}) {
  return {
    isAuthenticated: vi.fn().mockResolvedValue(false),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    handleSignInCallback: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn().mockResolvedValue('token'),
    getAccessTokenClaims: vi.fn().mockResolvedValue({ scope: 'read' }),
    getIdTokenClaims: vi.fn().mockResolvedValue({ sub: 'user-1' }),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let clientStub: ReturnType<typeof makeClientStub>;
  let routerSpy: { url: string; navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    clientStub = makeClientStub();
    routerSpy = { url: '/', navigateByUrl: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: LOGTO_CLIENT, useValue: clientStub },
        { provide: LOGTO_AUTH_CONFIG, useValue: TEST_CONFIG },
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('refreshAuthState', () => {
    it('pushes authenticated state and returns the value when true', async () => {
      clientStub.isAuthenticated.mockResolvedValue(true);
      const emitted: boolean[] = [];
      service.isAuthenticated$.subscribe((v) => emitted.push(v));

      const result = await service.refreshAuthState();

      expect(result).toBe(true);
      expect(emitted).toContain(true);
    });

    it('pushes false when client is not authenticated', async () => {
      clientStub.isAuthenticated.mockResolvedValue(false);
      const emitted: boolean[] = [];
      service.isAuthenticated$.subscribe((v) => emitted.push(v));

      const result = await service.refreshAuthState();

      expect(result).toBe(false);
      expect(emitted).toContain(false);
    });
  });

  describe('isAuthenticated$', () => {
    it('is distinctUntilChanged — does not re-emit equal successive values', async () => {
      clientStub.isAuthenticated.mockResolvedValue(false);
      const emitted: boolean[] = [];
      service.isAuthenticated$.subscribe((v) => emitted.push(v));

      // Initial value is false; refresh again with the same false value.
      await service.refreshAuthState();
      await service.refreshAuthState();

      // Should only have one false (the initial BehaviorSubject value, not duplicates).
      const falseCount = emitted.filter((v) => v === false).length;
      expect(falseCount).toBe(1);
    });
  });

  describe('signIn', () => {
    it('calls client.signIn with default redirect URI from config', () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://app.example.com' },
        configurable: true,
      });

      service.signIn();

      expect(clientStub.signIn).toHaveBeenCalledWith('https://app.example.com/auth/callback');

      Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
    });

    it('calls client.signIn with a custom redirect URI when provided', () => {
      service.signIn('https://custom.example.com/callback');

      expect(clientStub.signIn).toHaveBeenCalledWith('https://custom.example.com/callback');
    });
  });

  describe('handleCallback', () => {
    it('calls SDK handleSignInCallback then refreshes auth state', async () => {
      clientStub.isAuthenticated.mockResolvedValue(true);

      await service.handleCallback('https://app.example.com/auth/callback?code=abc');

      expect(clientStub.handleSignInCallback).toHaveBeenCalledWith(
        'https://app.example.com/auth/callback?code=abc',
      );
      expect(clientStub.isAuthenticated).toHaveBeenCalled();
    });
  });

  describe('getAccessToken', () => {
    it('delegates to client.getAccessToken and returns the token', async () => {
      const token = await service.getAccessToken(PRIMARY);

      expect(clientStub.getAccessToken).toHaveBeenCalledWith(PRIMARY);
      expect(token).toBe('token');
    });
  });

  describe('getAccessTokenClaims', () => {
    it('delegates to client.getAccessTokenClaims', async () => {
      const claims = await service.getAccessTokenClaims(PRIMARY);

      expect(clientStub.getAccessTokenClaims).toHaveBeenCalledWith(PRIMARY);
      expect(claims).toEqual({ scope: 'read' });
    });
  });

  describe('getIdTokenClaims', () => {
    it('delegates to client.getIdTokenClaims', async () => {
      const claims = await service.getIdTokenClaims();

      expect(clientStub.getIdTokenClaims).toHaveBeenCalled();
      expect(claims).toEqual({ sub: 'user-1' });
    });
  });

  describe('logout', () => {
    it('emits false on isAuthenticated$ and calls client.signOut', async () => {
      // First authenticate
      clientStub.isAuthenticated.mockResolvedValue(true);
      await service.refreshAuthState();

      const emitted: boolean[] = [];
      service.isAuthenticated$.subscribe((v) => emitted.push(v));

      service.logout();
      // Allow signOut promise to resolve
      await new Promise((r) => setTimeout(r, 0));

      expect(emitted).toContain(false);
      expect(clientStub.signOut).toHaveBeenCalled();
    });

    it('fires registered logout hooks', () => {
      const hookFn = vi.fn();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AuthService,
          { provide: LOGTO_CLIENT, useValue: clientStub },
          { provide: LOGTO_AUTH_CONFIG, useValue: TEST_CONFIG },
          { provide: Router, useValue: routerSpy },
          { provide: AUTH_LOGOUT_HOOK, multi: true, useValue: hookFn },
        ],
      });
      service = TestBed.inject(AuthService);

      service.logout();

      expect(hookFn).toHaveBeenCalled();
    });

    it('fires Observable logout hooks (fire-and-forget)', () => {
      const emitted: string[] = [];
      const hookFn = vi.fn(() => {
        const subject = new Subject<void>();
        subject.subscribe(() => emitted.push('fired'));
        subject.next();
        subject.complete();
        return subject;
      });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AuthService,
          { provide: LOGTO_CLIENT, useValue: clientStub },
          { provide: LOGTO_AUTH_CONFIG, useValue: TEST_CONFIG },
          { provide: Router, useValue: routerSpy },
          { provide: AUTH_LOGOUT_HOOK, multi: true, useValue: hookFn },
        ],
      });
      service = TestBed.inject(AuthService);

      service.logout();

      expect(emitted).toContain('fired');
    });

    it('navigates to signedOutPath when signOut rejects and not already there', async () => {
      clientStub.signOut.mockRejectedValue(new Error('network error'));
      routerSpy.url = '/dashboard';

      service.logout();
      await new Promise((r) => setTimeout(r, 0));

      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/auth/signed-out');
    });

    it('does not navigate when already on the signedOutPath after signOut rejection', async () => {
      clientStub.signOut.mockRejectedValue(new Error('network error'));
      routerSpy.url = '/auth/signed-out';

      service.logout();
      await new Promise((r) => setTimeout(r, 0));

      expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
    });
  });
});
