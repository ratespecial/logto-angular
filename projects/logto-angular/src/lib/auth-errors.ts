/**
 * OAuth token-endpoint error codes that mean the stored session can never be revived —
 * the grant itself was rejected, so retrying with the same refresh token is pointless.
 * Transient failures (network, 5xx) are deliberately absent: they must not trigger a
 * sign-out.
 */
const DEAD_GRANT_CODES: readonly string[] = [
  'invalid_grant',
  'invalid_client',
  'unauthorized_client',
];

/**
 * Logto namespaces the codes it returns from the token endpoint — a rejected refresh token
 * arrives as `oidc.invalid_grant`, not `invalid_grant` — while codes read out of a raw OIDC
 * error body are bare. Accept either form.
 */
function isDeadGrantCode(code: string | undefined): boolean {
  return DEAD_GRANT_CODES.some((dead) => code === dead || code?.endsWith(`.${dead}`));
}

/** The shape shared by `LogtoClientError`, `LogtoRequestError` and `LogtoError`. */
interface CodedLogtoError {
  name: string;
  code: string;
  data?: unknown;
}

/**
 * Narrows to a Logto SDK error by duck-typing rather than `instanceof`. `@logto/browser`
 * is a peer dependency, so a duplicated module instance (bundler pre-bundle vs. library
 * build) would break `instanceof` while leaving `name`/`code` intact. The SDK's own
 * `isLogtoRequestError` checks `name` for the same reason.
 */
function asCodedLogtoError(err: unknown): CodedLogtoError | undefined {
  if (!(err instanceof Error)) {
    return undefined;
  }

  const { code, data } = err as Error & { code?: unknown; data?: unknown };

  return typeof code === 'string' ? { name: err.name, code, data } : undefined;
}

/** Reads the `error` field of an OIDC error body (`{error, error_description}`). */
function oidcErrorCode(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }

  const { error } = data as { error?: unknown };

  return typeof error === 'string' ? error : undefined;
}

/**
 * True when the error means the stored Logto session is unusable and cannot be refreshed —
 * the only recoverable move is to flush the stored tokens and sign in again.
 *
 * The SDK surfaces this in three different shapes:
 *
 * - `LogtoClientError` / `not_authenticated` — no ID token, or the refresh token is gone.
 * - `LogtoRequestError` / `oidc.invalid_grant` — the token endpoint rejected the refresh token
 *   and answered with a Logto-shaped `{code, message}` body.
 * - `LogtoError` / `unexpected_response_error` — the same rejection, but the OIDC provider
 *   answered with a plain `{error: 'invalid_grant', error_description}` body, which fails
 *   the SDK's `isLogtoRequestErrorJson` check and is wrapped as an unexpected response.
 */
export function isDeadSessionError(err: unknown): boolean {
  const coded = asCodedLogtoError(err);

  if (!coded) {
    return false;
  }

  switch (coded.name) {
    case 'LogtoClientError':
      return coded.code === 'not_authenticated';

    case 'LogtoRequestError':
      return isDeadGrantCode(coded.code);

    case 'LogtoError':
      return (
        coded.code === 'unexpected_response_error' && isDeadGrantCode(oidcErrorCode(coded.data))
      );

    default:
      return false;
  }
}
