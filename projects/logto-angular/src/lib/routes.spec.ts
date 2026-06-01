import { getAuthRoutes } from './routes';
import { CallbackComponent } from './callback/callback.component';
import { SignedOutComponent } from './signed-out/signed-out.component';

describe('getAuthRoutes', () => {
  const routing = {
    callbackPath: '/auth/callback',
    signedOutPath: '/auth/signed-out',
  };

  it('returns two routes for callback and signed-out', () => {
    const routes = getAuthRoutes(routing);
    expect(routes).toHaveLength(2);
  });

  it('strips the leading slash from callbackPath', () => {
    const routes = getAuthRoutes(routing);
    const callbackRoute = routes.find((r) => r.component === CallbackComponent);
    expect(callbackRoute?.path).toBe('auth/callback');
  });

  it('strips the leading slash from signedOutPath', () => {
    const routes = getAuthRoutes(routing);
    const signedOutRoute = routes.find((r) => r.component === SignedOutComponent);
    expect(signedOutRoute?.path).toBe('auth/signed-out');
  });

  it('maps callbackPath to CallbackComponent', () => {
    const routes = getAuthRoutes(routing);
    const callbackRoute = routes.find((r) => r.component === CallbackComponent);
    expect(callbackRoute).toBeDefined();
  });

  it('maps signedOutPath to SignedOutComponent', () => {
    const routes = getAuthRoutes(routing);
    const signedOutRoute = routes.find((r) => r.component === SignedOutComponent);
    expect(signedOutRoute).toBeDefined();
  });

  it('handles paths without a leading slash', () => {
    const routes = getAuthRoutes({ callbackPath: 'auth/cb', signedOutPath: 'auth/bye' });
    expect(routes[0].path).toBe('auth/cb');
    expect(routes[1].path).toBe('auth/bye');
  });
});
