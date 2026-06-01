import { TestBed } from '@angular/core/testing';
import { Router, RoutesRecognized } from '@angular/router';
import { Subject } from 'rxjs';
import { initializeRouteTracking } from './route-tracking.initializer';
import { HistoryService } from '../history.service';

function makeRoutesRecognized(url: string): RoutesRecognized {
  // RoutesRecognized extends RouterEvent which requires (id, url); the initializer only
  // reads urlAfterRedirects, so pass `url` for both.
  return new RoutesRecognized(0, url, url, {} as never);
}

describe('initializeRouteTracking', () => {
  let eventsSubject: Subject<unknown>;
  let routerStub: { events: Subject<unknown> };
  let historyService: { setLastVisitedRoute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    eventsSubject = new Subject<unknown>();
    routerStub = { events: eventsSubject };
    historyService = { setLastVisitedRoute: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: HistoryService, useValue: historyService },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores the route on RoutesRecognized events for non-auth paths', () => {
    TestBed.runInInjectionContext(() => {
      const initializer = initializeRouteTracking();
      initializer();
    });

    eventsSubject.next(makeRoutesRecognized('/dashboard'));
    eventsSubject.next(makeRoutesRecognized('/settings/profile'));

    expect(historyService.setLastVisitedRoute).toHaveBeenCalledWith('/dashboard');
    expect(historyService.setLastVisitedRoute).toHaveBeenCalledWith('/settings/profile');
  });

  it('excludes /auth/* routes to prevent redirect loops', () => {
    TestBed.runInInjectionContext(() => {
      const initializer = initializeRouteTracking();
      initializer();
    });

    eventsSubject.next(makeRoutesRecognized('/auth/callback'));
    eventsSubject.next(makeRoutesRecognized('/auth/signed-out'));

    expect(historyService.setLastVisitedRoute).not.toHaveBeenCalled();
  });

  it('stores non-auth routes but skips auth routes in mixed sequence', () => {
    TestBed.runInInjectionContext(() => {
      const initializer = initializeRouteTracking();
      initializer();
    });

    eventsSubject.next(makeRoutesRecognized('/dashboard'));
    eventsSubject.next(makeRoutesRecognized('/auth/callback'));
    eventsSubject.next(makeRoutesRecognized('/reports'));

    expect(historyService.setLastVisitedRoute).toHaveBeenCalledTimes(2);
    expect(historyService.setLastVisitedRoute).toHaveBeenCalledWith('/dashboard');
    expect(historyService.setLastVisitedRoute).toHaveBeenCalledWith('/reports');
  });
});
