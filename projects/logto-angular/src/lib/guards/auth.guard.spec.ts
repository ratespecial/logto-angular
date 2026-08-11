import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../auth.service';
import { HistoryService } from '../history.service';
import { PRIMARY_RESOURCE } from '../tokens';

const PRIMARY = 'https://api.example.test';

function makeRouteState(url: string): RouterStateSnapshot {
  return { url } as RouterStateSnapshot;
}

describe('authGuard', () => {
  let authService: {
    refreshAuthState: ReturnType<typeof vi.fn>;
    signIn: ReturnType<typeof vi.fn>;
    getAccessToken: ReturnType<typeof vi.fn>;
  };
  let historyService: { setLastVisitedRoute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = {
      refreshAuthState: vi.fn().mockResolvedValue(false),
      signIn: vi.fn(),
      getAccessToken: vi.fn().mockResolvedValue('my-jwt'),
    };
    historyService = {
      setLastVisitedRoute: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: HistoryService, useValue: historyService },
        { provide: PRIMARY_RESOURCE, useValue: PRIMARY },
      ],
    });

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when the user is authenticated', async () => {
    authService.refreshAuthState.mockResolvedValue(true);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, makeRouteState('/dashboard')),
    );

    expect(result).toBe(true);
    expect(authService.getAccessToken).toHaveBeenCalledWith(PRIMARY);
    expect(authService.signIn).not.toHaveBeenCalled();
  });

  it('never resolves when a stored session turns out to be dead', async () => {
    // A stale ID token makes `refreshAuthState()` report true; only fetching a token proves
    // otherwise. `AuthService` flushes and redirects, leaving its promise pending while the
    // browser navigates away — so the guard never settles either.
    authService.refreshAuthState.mockResolvedValue(true);
    authService.getAccessToken.mockReturnValue(new Promise(() => undefined));

    const settled = await Promise.race([
      TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, makeRouteState('/dashboard')),
      ),
      new Promise((resolve) => setTimeout(() => resolve('pending'), 10)),
    ]);

    expect(settled).toBe('pending');
  });

  it('allows navigation when the token fetch fails transiently', async () => {
    authService.refreshAuthState.mockResolvedValue(true);
    authService.getAccessToken.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, makeRouteState('/dashboard')),
    );

    expect(result).toBe(true);
    expect(authService.signIn).not.toHaveBeenCalled();
  });

  it('returns false and initiates sign-in when unauthenticated', async () => {
    authService.refreshAuthState.mockResolvedValue(false);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, makeRouteState('/dashboard')),
    );

    expect(result).toBe(false);
    expect(authService.signIn).toHaveBeenCalled();
  });

  it('records the attempted non-auth route before sign-in', async () => {
    authService.refreshAuthState.mockResolvedValue(false);

    await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, makeRouteState('/dashboard')),
    );

    expect(historyService.setLastVisitedRoute).toHaveBeenCalledWith('/dashboard');
  });

  it('does NOT record the route when the URL starts with /auth', async () => {
    authService.refreshAuthState.mockResolvedValue(false);

    await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, makeRouteState('/auth/callback')),
    );

    expect(historyService.setLastVisitedRoute).not.toHaveBeenCalled();
  });
});
