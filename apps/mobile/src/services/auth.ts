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

let silentReauthPromise: Promise<LoginResult> | null = null;

export interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
  isRetrying?: boolean;
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
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      console.log(`Login attempt ${attempt}/${RETRY_CONFIG.maxAttempts} for ${email}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(`Login request timeout after ${API_TIMEOUT}ms (attempt ${attempt})`)
        controller.abort();
      }, API_TIMEOUT);

      const response = await fetch(buildApiUrl(apiUrl, '/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        lastError = new Error(body.message ?? `Login failed (HTTP ${response.status})`);

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
        return { success: true, token };
      }
    } catch (err) {
      clearTimeout(0);
      lastError = err instanceof Error ? err : new Error('Unknown error');

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
        await sleep(delay);
        continue;
      }

      // Format the error message
      let errorMessage = lastError.message;
      if (lastError.name === 'AbortError') {
        errorMessage = `Connection timeout. Backend is taking too long to respond. Please try again.`;
      }

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
export async function logout(): Promise<void> {
  await Promise.all([deleteToken(), deleteUserEmail(), deleteUserRole(), deleteUserPhotoUrl()]);
}

/**
 * Re-authenticate without user input by reusing the stored user email.
 * This is used when token is expired/invalid during background sync.
 */
export async function reauthenticateSilently(): Promise<LoginResult> {
  if (silentReauthPromise) {
    return silentReauthPromise;
  }

  silentReauthPromise = (async () => {
    const storedEmail = await getUserEmail();

    if (!storedEmail) {
      return {
        success: false,
        error: 'No stored user email. Please log in again.',
      };
    }

    console.log('Attempting silent re-authentication...');
    const result = await login(storedEmail);

    if (result.success) {
      console.log('✅ Silent re-authentication successful');
    } else {
      console.warn(`Silent re-authentication failed: ${result.error ?? 'Unknown error'}`);
    }

    return result;
  })();

  try {
    return await silentReauthPromise;
  } finally {
    silentReauthPromise = null;
  }
}
