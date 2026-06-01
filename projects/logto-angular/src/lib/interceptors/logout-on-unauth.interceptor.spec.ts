import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { logoutOnUnauthInterceptor } from './logout-on-unauth.interceptor';
import { AuthService } from '../auth.service';

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
});
