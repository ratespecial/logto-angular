import { TestBed } from '@angular/core/testing';
import { HistoryService } from './history.service';

const STORAGE_KEY = 'auth.lastVisitedRoute';

describe('HistoryService', () => {
  let service: HistoryService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [HistoryService] });
    service = TestBed.inject(HistoryService);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getLastVisitedRoute', () => {
    it('returns null when nothing has been stored', () => {
      expect(service.getLastVisitedRoute()).toBeNull();
    });

    it('returns the value previously stored under the auth.lastVisitedRoute key', () => {
      sessionStorage.setItem(STORAGE_KEY, '/dashboard');

      expect(service.getLastVisitedRoute()).toBe('/dashboard');
    });

    it('returns null and logs the error if sessionStorage.getItem throws', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('boom');
      });

      expect(service.getLastVisitedRoute()).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('setLastVisitedRoute', () => {
    it('writes the value to sessionStorage under auth.lastVisitedRoute', () => {
      service.setLastVisitedRoute('/payees');

      expect(sessionStorage.getItem(STORAGE_KEY)).toBe('/payees');
    });

    it('overwrites a previously stored value', () => {
      service.setLastVisitedRoute('/payees');
      service.setLastVisitedRoute('/dashboard');

      expect(sessionStorage.getItem(STORAGE_KEY)).toBe('/dashboard');
    });

    it('swallows and logs sessionStorage failures (e.g. quota exceeded)', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => service.setLastVisitedRoute('/dashboard')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('clearLastVisitedRoute', () => {
    it('removes the value from sessionStorage', () => {
      service.setLastVisitedRoute('/payees');

      service.clearLastVisitedRoute();

      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(service.getLastVisitedRoute()).toBeNull();
    });

    it('is a no-op when no value is stored', () => {
      expect(() => service.clearLastVisitedRoute()).not.toThrow();
      expect(service.getLastVisitedRoute()).toBeNull();
    });

    it('swallows and logs sessionStorage failures', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('boom');
      });

      expect(() => service.clearLastVisitedRoute()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('consumeLastVisitedRoute', () => {
    it('returns the stored value and clears it in one call', () => {
      service.setLastVisitedRoute('/payees');

      expect(service.consumeLastVisitedRoute()).toBe('/payees');
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(service.consumeLastVisitedRoute()).toBeNull();
    });

    it('returns null when nothing is stored', () => {
      expect(service.consumeLastVisitedRoute()).toBeNull();
    });
  });
});
