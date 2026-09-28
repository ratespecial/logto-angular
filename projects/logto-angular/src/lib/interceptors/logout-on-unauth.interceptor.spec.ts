import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { logoutOnUnauthInterceptor } from './logout-on-unauth.interceptor';
import { AuthService } from '../auth.service';
import { LOGTO_AUTH_CONFIG, PRIMARY_RESOURCE } from '../tokens';
import { LogtoAuthConfig } from '../logto.config';

const PRIMARY = 'https://api.example.test';
const SECONDARY = 'https://secondary.example.test';

const config = {
  endpoint: 'https://logto.example.test',
  appId: 'app',
  routing: {
    callbackPath: '/auth/callback',
    signedOutPath: '/auth/signed-out',
    primaryResource: PRIMARY,
    secureRoutes: [
      { resource: PRIMARY, routes: ['/api'] },
      { resource: SECONDARY, routes: [SECONDARY] },
    ],
  },
} satisfies LogtoAuthConfig;

describe('logoutOnUnauthInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let authService: { logout: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = { logout: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([logoutOnUnauthInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
        { provide: LOGTO_AUTH_CONFIG, useValue: config },
        { provide: PRIMARY_RESOURCE, useValue: PRIMARY },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  it('calls authService.logout() when the response status is 401', async () => {
    const responsePromise = http
      .get('/api/data')
      .toPromise()
      .catch(() => null);

    const req = httpTesting.expectOne('/api/data');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    await responsePromise;

    expect(authService.logout).toHaveBeenCalledOnce();
  });

  it('does NOT call logout for non-401 HTTP errors', async () => {
    const responsePromise = http
      .get('/api/data')
      .toPromise()
      .catch(() => null);

    const req = httpTesting.expectOne('/api/data');
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

    await responsePromise;

    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('does NOT call logout on a successful response', async () => {
    const responsePromise = http.get('/api/data').toPromise();

    const req = httpTesting.expectOne('/api/data');
    req.flush({ data: 'ok' });

    await responsePromise;

    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('does NOT call logout for a 401 from a secondary resource, and still propagates the error', async () => {
    const responsePromise = http
      .get(`${SECONDARY}/api/data`)
      .toPromise()
      .then(
        () => null,
        (err: unknown) => err,
      );

    const req = httpTesting.expectOne(`${SECONDARY}/api/data`);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const err = await responsePromise;

    expect(authService.logout).not.toHaveBeenCalled();
    expect(err).toBeInstanceOf(HttpErrorResponse);
    expect((err as HttpErrorResponse).status).toBe(401);
  });

  it('calls logout for a 401 from a URL matching no secure route', async () => {
    const responsePromise = http
      .get('/other/data')
      .toPromise()
      .catch(() => null);

    const req = httpTesting.expectOne('/other/data');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    await responsePromise;

    expect(authService.logout).toHaveBeenCalledOnce();
  });
});
