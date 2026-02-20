import {
  getApiUrl,
  setToken,
  setUserEmail,
  getToken,
  deleteToken,
  deleteUserEmail,
  setUserRole,
  deleteUserRole,
} from './secureStorage';

export interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
}

function isJwtToken(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

/**
 * Login with email via the API's /login endpoint.
 * On success the JWT is persisted in the device's secure enclave.
 */
export async function login(email: string): Promise<LoginResult> {
  try {
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return {
        success: false,
        error: body.message ?? `Login failed (HTTP ${response.status})`,
      };
    }

    const data = await response.json();
    const token: string | undefined = data.token;

    if (!token || !isJwtToken(token)) {
      return {
        success: false,
        error: 'Invalid token received from server. Please try again.',
      };
    }
    const userEmail: string = data.user?.email ?? email;
    const userRole: string = data.user?.role ?? '';

    await Promise.all([
      setToken(token),
      setUserEmail(userEmail),
      ...(userRole ? [setUserRole(userRole)] : []),
    ]);
    return { success: true, token };
  } catch (err) {
    console.error('Login error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
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
  await Promise.all([deleteToken(), deleteUserEmail(), deleteUserRole()]);
}
