import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CallbackComponent } from './callback.component';
import { AuthService } from '../auth.service';
import { HistoryService } from '../history.service';
import { LOGTO_AUTH_CONFIG, PRIMARY_RESOURCE } from '../tokens';
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

describe('CallbackComponent', () => {
  let authService: {
    handleCallback: ReturnType<typeof vi.fn>;
    getAccessTokenClaims: ReturnType<typeof vi.fn>;
  };
  let historyService: { consumeLastVisitedRoute: ReturnType<typeof vi.fn> };
  let routerSpy: { navigateByUrl: ReturnType<typeof vi.fn> };

  function createComponent() {
    return TestBed.createComponent(CallbackComponent);
  }

  beforeEach(() => {
    authService = {
      handleCallback: vi.fn().mockResolvedValue(undefined),
      getAccessTokenClaims: vi.fn().mockResolvedValue({ scope: 'read write' }),
    };
    historyService = { consumeLastVisitedRoute: vi.fn().mockReturnValue(null) };
    routerSpy = { navigateByUrl: vi.fn() };

    TestBed.configureTestingModule({
      imports: [CallbackComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: HistoryService, useValue: historyService },
        { provide: Router, useValue: routerSpy },
        { provide: LOGTO_AUTH_CONFIG, useValue: TEST_CONFIG },
        { provide: PRIMARY_RESOURCE, useValue: PRIMARY },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('navigates to the consumed last-visited route on success', async () => {
    historyService.consumeLastVisitedRoute.mockReturnValue('/dashboard');
    const fixture = createComponent();

    await fixture.componentInstance.ngOnInit();

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('falls back to "/" when no last-visited route is stored', async () => {
    historyService.consumeLastVisitedRoute.mockReturnValue(null);
    const fixture = createComponent();

    await fixture.componentInstance.ngOnInit();

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('sets error and does not navigate when scope is empty', async () => {
    authService.getAccessTokenClaims.mockResolvedValue({ scope: '' });
    const fixture = createComponent();

    await fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.error()).toBeTruthy();
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('shows the custom noAccessMessage when configured and scope is empty', async () => {
    const customMessage = 'Contact your administrator for access.';
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CallbackComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: HistoryService, useValue: historyService },
        { provide: Router, useValue: routerSpy },
        {
          provide: LOGTO_AUTH_CONFIG,
          useValue: { ...TEST_CONFIG, noAccessMessage: customMessage },
        },
        { provide: PRIMARY_RESOURCE, useValue: PRIMARY },
      ],
    });
    authService.getAccessTokenClaims.mockResolvedValue({ scope: '' });
    const fixture = TestBed.createComponent(CallbackComponent);

    await fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.error()).toBe(customMessage);
  });

  it('sets error message on thrown Error and stops loading', async () => {
    authService.handleCallback.mockRejectedValue(new Error('Invalid state'));
    const fixture = createComponent();

    await fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.error()).toBe('Invalid state');
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('sets generic error message when a non-Error is thrown', async () => {
    authService.handleCallback.mockRejectedValue('some string error');
    const fixture = createComponent();

    await fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.error()).toBe('Authentication failed.');
  });

  it('starts with loading=true, sets loading=false after success', async () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.loading()).toBe(true);

    await fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('sets loading=false on error', async () => {
    authService.handleCallback.mockRejectedValue(new Error('fail'));
    const fixture = createComponent();

    await fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
