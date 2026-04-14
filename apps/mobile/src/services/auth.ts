import {
  buildApiUrl,
  getApiUrl,
  setToken,
  setUserEmail,
  getToken,
  getUserEmail,
  deleteToken,
  deleteUserEmail,
  setUserRole,
  deleteUserRole,
  deleteUserPhotoUrl,
} from './secureStorage';
import { API_TIMEOUT, RETRY_CONFIG } from '@/constants/config';
import { logDiagnostic } from './diagnostics';

let silentReauthPromise: Promise<LoginResult> | null = null;

export interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
  isRetrying?: boolean;
}

type AuthFailureReason =
  | 'timeout'
  | 'network'
  | 'invalid_token'
  | 'client_error'
  | 'server_error'
  | 'unknown';

export type LogoutReason = 'user_action' | 'auth_recovery_failed' | 'token_invalid' | 'unknown';

function classifyAuthFailure(error: Error, statusCode?: number): AuthFailureReason {
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    return 'timeout';
  }

  if (
    error.message.includes('Network') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ETIMEDOUT')
  ) {
    return 'network';
  }

  if (error.message.includes('Invalid token')) {
    return 'invalid_token';
  }

  if (typeof statusCode === 'number') {
    if (statusCode >= 400 && statusCode < 500) {
      return 'client_error';
    }

    if (statusCode >= 500) {
      return 'server_error';
    }
  }

  return 'unknown';
}

function isJwtToken(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

/**
 * Calculate delay with exponential backoff
 */
function getBackoffDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
    RETRY_CONFIG.maxDelayMs
  );
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return delay + jitter;
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Login with email via the API's /login endpoint.
 * On success the JWT is persisted in the device's secure enclave.
 * Includes retry logic with exponential backoff for resilience.
 */
export async function login(email: string): Promise<LoginResult> {
  const apiUrl = await getApiUrl();
  const loginUrl = buildApiUrl(apiUrl, '/login');
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    const attemptStartedAt = Date.now();
    try {
      console.log(`Login attempt ${attempt}/${RETRY_CONFIG.maxAttempts} for ${email}`);
      logDiagnostic('auth.login.attempt', {
        email,
        attempt,
        maxAttempts: RETRY_CONFIG.maxAttempts,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(`Login request timeout after ${API_TIMEOUT}ms (attempt ${attempt})`)
        controller.abort();
      }, API_TIMEOUT);

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        lastError = new Error(body.message ?? `Login failed (HTTP ${response.status})`);
        logDiagnostic(
          'auth.login.http_error',
          {
            email,
            attempt,
            httpStatus: response.status,
            reason: classifyAuthFailure(lastError, response.status),
            durationMs: Date.now() - attemptStartedAt,
          },
          response.status >= 500 ? 'warn' : 'error'
        );

        // Don't retry on 4xx errors except timeout
        if (response.status >= 400 && response.status < 500) {
          throw lastError;
        }
      } else {
        const data = await response.json();
        const token: string | undefined = data.token;

        if (!token || !isJwtToken(token)) {
          throw new Error('Invalid token received from server. Please try again.');
        }

        const userEmail: string = data.user?.email ?? email;
        const userRole: string = data.user?.role ?? '';

        await Promise.all([
          setToken(token),
          setUserEmail(userEmail),
          ...(userRole ? [setUserRole(userRole)] : []),
        ]);

        console.log('✅ Login successful');
        logDiagnostic('auth.login.success', {
          email: userEmail,
          durationMs: Date.now() - attemptStartedAt,
          attempt,
        });
        return { success: true, token };
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
      const reason = classifyAuthFailure(lastError);

      // Check if error is retryable
      const isRetryable =
        lastError.name === 'AbortError' ||
        lastError.message.includes('Network') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('ECONNREFUSED');

      if (isRetryable && attempt < RETRY_CONFIG.maxAttempts) {
        const delay = getBackoffDelay(attempt);
        console.warn(`Attempt ${attempt} failed (${lastError.message}), retrying in ${Math.round(delay)}ms...`);
        logDiagnostic('auth.login.retry', {
          email,
          attempt,
          maxAttempts: RETRY_CONFIG.maxAttempts,
          retryDelayMs: Math.round(delay),
          reason,
          error: lastError.message,
        }, 'warn');
        await sleep(delay);
        continue;
      }

      // Format the error message
      let errorMessage = lastError.message;
      if (lastError.name === 'AbortError') {
        errorMessage = `Connection timeout. Backend is taking too long to respond. Please try again.`;
      } else if (
        lastError.message.includes('Network request failed') ||
        lastError.message.includes('Network') ||
        lastError.message.includes('ECONNREFUSED')
      ) {
        errorMessage = `Cannot reach backend at ${loginUrl}. Check API URL and network access (on iOS, localhost points to the phone/simulator itself).`;
      }

      logDiagnostic('auth.login.failed', {
        email,
        attempt,
        maxAttempts: RETRY_CONFIG.maxAttempts,
        reason,
        error: errorMessage,
      }, 'error');

      return {
        success: false,
        error: errorMessage,
        isRetrying: attempt < RETRY_CONFIG.maxAttempts,
      };
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Login failed after multiple attempts. Please check your connection.',
  };
}

/**
 * Returns true if a valid token exists in secure storage.
 * Use this for initial auth-guard checks (does NOT verify with the server).
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  return token !== null && token.length > 0;
}

/**
 * Clear the JWT and user email from secure storage.
 */
export async function logout(reason: LogoutReason = 'user_action'): Promise<void> {
  logDiagnostic('auth.logout', { reason });
  await Promise.all([deleteToken(), deleteUserEmail(), deleteUserRole(), deleteUserPhotoUrl()]);
}

/**
 * Re-authenticate without user input by reusing the stored user email.
 * This is used when token is expired/invalid during background sync.
 */
export async function reauthenticateSilently(): Promise<LoginResult> {
  if (silentReauthPromise) {
    logDiagnostic('auth.reauth.join_existing');
    return silentReauthPromise;
  }

  silentReauthPromise = (async () => {
    const storedEmail = await getUserEmail();

    if (!storedEmail) {
      logDiagnostic('auth.reauth.failed', { reason: 'missing_stored_email' }, 'warn');
      return {
        success: false,
        error: 'No stored user email. Please log in again.',
      };
    }

    console.log('Attempting silent re-authentication...');
    logDiagnostic('auth.reauth.attempt', { email: storedEmail });
    const result = await login(storedEmail);

    if (result.success) {
      console.log('✅ Silent re-authentication successful');
      logDiagnostic('auth.reauth.success', { email: storedEmail });
    } else {
      console.warn(`Silent re-authentication failed: ${result.error ?? 'Unknown error'}`);
      logDiagnostic('auth.reauth.failed', {
        email: storedEmail,
        reason: result.error ?? 'unknown',
      }, 'warn');
    }

    return result;
  })();

  try {
    return await silentReauthPromise;
  } finally {
    silentReauthPromise = null;
  }
}
