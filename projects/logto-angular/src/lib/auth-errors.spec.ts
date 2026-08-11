import { isDeadSessionError } from './auth-errors';

/** Mirrors `LogtoClientError` from `@logto/client` without importing the SDK. */
function logtoClientError(code: string, data?: unknown): Error {
  return Object.assign(new Error('Not authenticated.'), {
    name: 'LogtoClientError',
    code,
    data,
  });
}

/** Mirrors `LogtoRequestError` — thrown when the server answers `{code, message}`. */
function logtoRequestError(code: string): Error {
  return Object.assign(new Error('server said no'), { name: 'LogtoRequestError', code });
}

/** Mirrors `LogtoError` — wraps a response body the SDK could not classify. */
function logtoError(code: string, data?: unknown): Error {
  return Object.assign(new Error('Unexpected response error from the server.'), {
    name: 'LogtoError',
    code,
    data,
  });
}

describe('isDeadSessionError', () => {
  describe('LogtoClientError', () => {
    it('is true for not_authenticated (no ID token / no refresh token)', () => {
      expect(isDeadSessionError(logtoClientError('not_authenticated'))).toBe(true);
      expect(
        isDeadSessionError(logtoClientError('not_authenticated', 'Refresh token not found')),
      ).toBe(true);
    });

    it('is false for unrelated client errors', () => {
      expect(isDeadSessionError(logtoClientError('sign_in_session.not_found'))).toBe(false);
      expect(isDeadSessionError(logtoClientError('missing_scope_organizations'))).toBe(false);
      expect(isDeadSessionError(logtoClientError('user_cancelled'))).toBe(false);
    });
  });

  describe('LogtoRequestError', () => {
    it('is true for the namespaced code Logto actually returns', () => {
      expect(isDeadSessionError(logtoRequestError('oidc.invalid_grant'))).toBe(true);
    });

    it('is true for bare grant rejections', () => {
      expect(isDeadSessionError(logtoRequestError('invalid_grant'))).toBe(true);
      expect(isDeadSessionError(logtoRequestError('invalid_client'))).toBe(true);
      expect(isDeadSessionError(logtoRequestError('unauthorized_client'))).toBe(true);
    });

    it('is false for other request failures', () => {
      expect(isDeadSessionError(logtoRequestError('server.internal_error'))).toBe(false);
      expect(isDeadSessionError(logtoRequestError('request.invalid_input'))).toBe(false);
      expect(isDeadSessionError(logtoRequestError('session.invalid_grant_type'))).toBe(false);
    });
  });

  describe('LogtoError (plain OIDC error body)', () => {
    it('is true when the wrapped body reports a dead grant', () => {
      // The body Logto actually returns from POST /oidc/token for a dead refresh token.
      const err = logtoError('unexpected_response_error', {
        code: 'oidc.invalid_grant',
        message: 'Grant request is invalid.',
        error: 'invalid_grant',
        error_description: 'grant request is invalid',
      });

      expect(isDeadSessionError(err)).toBe(true);
    });

    it('is false when the wrapped body reports something else', () => {
      expect(
        isDeadSessionError(logtoError('unexpected_response_error', { error: 'server_error' })),
      ).toBe(false);
    });

    it('is false when there is no usable body', () => {
      expect(isDeadSessionError(logtoError('unexpected_response_error'))).toBe(false);
      expect(isDeadSessionError(logtoError('unexpected_response_error', null))).toBe(false);
      expect(isDeadSessionError(logtoError('unexpected_response_error', 'invalid_grant'))).toBe(
        false,
      );
    });

    it('is false for other Logto error codes even with a dead-grant body', () => {
      expect(
        isDeadSessionError(logtoError('id_token.invalid_token', { error: 'invalid_grant' })),
      ).toBe(false);
    });
  });

  describe('non-session failures', () => {
    it('is false for transient network errors', () => {
      expect(isDeadSessionError(new TypeError('Failed to fetch'))).toBe(false);
    });

    it('is false for plain errors and non-errors', () => {
      expect(isDeadSessionError(new Error('boom'))).toBe(false);
      expect(isDeadSessionError(undefined)).toBe(false);
      expect(isDeadSessionError(null)).toBe(false);
      expect(isDeadSessionError('invalid_grant')).toBe(false);
      expect(isDeadSessionError({ name: 'LogtoClientError', code: 'not_authenticated' })).toBe(
        false,
      );
    });

    it('is false when the code is not a string', () => {
      const err = Object.assign(new Error('weird'), { name: 'LogtoRequestError', code: 401 });

      expect(isDeadSessionError(err)).toBe(false);
    });
  });
});
