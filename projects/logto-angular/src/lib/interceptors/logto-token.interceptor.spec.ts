import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { logtoTokenInterceptor, resourceForUrl } from './logto-token.interceptor';
import { AuthService } from '../auth.service';
import { LOGTO_AUTH_CONFIG } from '../tokens';
import type { LogtoAuthConfig } from '../logto.config';

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

describe('resourceForUrl (unit)', () => {
  const mappings = [
    { resource: 'https://api.example.test', routes: ['/api'] },
    { resource: 'https://billing.example.test', routes: ['/billing', '/payments'] },
  ];

  it('returns the resource whose route matches by startsWith', () => {
    expect(resourceForUrl('/api/users', mappings)).toBe('https://api.example.test');
    expect(resourceForUrl('/billing/invoice', mappings)).toBe('https://billing.example.test');
    expect(resourceForUrl('/payments/confirm', mappings)).toBe('https://billing.example.test');
  });

  it('returns undefined for an unmatched URL', () => {
    expect(resourceForUrl('/public/page', mappings)).toBeUndefined();
  });

  it('returns undefined for an empty mappings array', () => {
    expect(resourceForUrl('/api/users', [])).toBeUndefined();
  });
});

describe('logtoTokenInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let authService: { getAccessToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = { getAccessToken: vi.fn().mockResolvedValue('my-jwt') };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([logtoTokenInterceptor])),
        provideHttpClientTesting(),
        { provide: LOGTO_AUTH_CONFIG, useValue: TEST_CONFIG },
        { provide: AuthService, useValue: authService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches Bearer Authorization header for a matched route', async () => {
    http.get('/api/users').subscribe();

    // The interceptor calls getAccessToken (a Promise), so we wait for the microtask queue.
    await Promise.resolve();

    const req = httpTesting.expectOne('/api/users');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt');
    req.flush([]);
    httpTesting.verify();
  });

  it('passes through without Authorization for an unmatched route', async () => {
    http.get('/public/data').subscribe();

    // Unmatched routes bypass the async branch entirely — no await needed.
    const req = httpTesting.expectOne('/public/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    httpTesting.verify();
  });

  it('passes through without Authorization when token is empty', async () => {
    authService.getAccessToken.mockResolvedValue('');
    http.get('/api/users').subscribe();

    await Promise.resolve();

    const req = httpTesting.expectOne('/api/users');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
    httpTesting.verify();
  });

  it('leaves the request pending while a dead session redirects', async () => {
    // `AuthService` never settles the token promise once it starts the recovery redirect, so
    // nothing is emitted and no error reaches the app before the page unloads.
    authService.getAccessToken.mockReturnValue(new Promise(() => undefined));

    let settled = false;
    http.get('/api/users').subscribe({
      next: () => (settled = true),
      error: () => (settled = true),
      complete: () => (settled = true),
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(settled).toBe(false);
    httpTesting.expectNone('/api/users');
  });

  it('surfaces token failures that are not session death', async () => {
    authService.getAccessToken.mockRejectedValue(new TypeError('Failed to fetch'));

    let errored: unknown = null;
    http.get('/api/users').subscribe({ error: (err: unknown) => (errored = err) });

    await Promise.resolve();
    await Promise.resolve();

    expect(errored).toBeInstanceOf(TypeError);
    httpTesting.expectNone('/api/users');
    httpTesting.verify();
  });
});
