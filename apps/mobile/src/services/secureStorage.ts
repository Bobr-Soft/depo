import * as SecureStore from 'expo-secure-store';

// All keys stored in the device's secure enclave
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  API_URL: 'api_url',
  USER_EMAIL: 'user_email',
  USER_ROLE: 'user_role',
  USER_PHOTO_URL: 'user_photo_url',
  SCAN_SOUND_ENABLED: 'scan_sound_enabled',
  HAPTIC_FEEDBACK_ENABLED: 'haptic_feedback_enabled',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// Default to Render API, allow EXPO_PUBLIC_API_URL override at build time
const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://depo-tj5n.onrender.com';

function normalizeApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function buildApiUrl(baseUrl: string, path: string): string {
  const normalizedBase = normalizeApiBaseUrl(baseUrl);
  const normalizedPath = `/${String(path || '').replace(/^\/+/, '')}`;
  return `${normalizedBase}${normalizedPath}`;
}

// ─── Token ──────────────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
  } catch {
    // Silently fail
  }
}

export async function deleteToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  } catch {
    // Silently fail
  }
}

// ─── API URL ─────────────────────────────────────────────────────────────────

/**
 * Returns the stored API URL, or the compile-time default if none is saved.
 * Call setApiUrl() from a settings screen to override it at runtime.
 */
export async function getApiUrl(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEYS.API_URL);
    return normalizeApiBaseUrl(stored ?? DEFAULT_API_URL);
  } catch {
    return normalizeApiBaseUrl(DEFAULT_API_URL);
  }
}

export async function setApiUrl(url: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.API_URL, normalizeApiBaseUrl(url));
  } catch {
    // Silently fail
  }
}

// ─── User email ──────────────────────────────────────────────────────────────

export async function getUserEmail(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.USER_EMAIL);
  } catch {
    return null;
  }
}

export async function setUserEmail(email: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.USER_EMAIL, email);
  } catch {
    // Silently fail
  }
}

export async function deleteUserEmail(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_EMAIL);
  } catch {
    // Silently fail
  }
}

// ─── User role ───────────────────────────────────────────────────────────────

export async function getUserRole(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.USER_ROLE);
  } catch {
    return null;
  }
}

export async function setUserRole(role: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.USER_ROLE, role);
  } catch {
    // Silently fail
  }
}

export async function deleteUserRole(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ROLE);
  } catch {
    // Silently fail
  }
}

export async function getUserPhotoUrl(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.USER_PHOTO_URL);
  } catch {
    return null;
  }
}

export async function setUserPhotoUrl(photoUrl: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.USER_PHOTO_URL, photoUrl);
  } catch {
    // Silently fail
  }
}

export async function deleteUserPhotoUrl(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_PHOTO_URL);
  } catch {
    // Silently fail
  }
}

export async function getScanSoundEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(STORAGE_KEYS.SCAN_SOUND_ENABLED);
    if (value === null) return true;
    return value === 'true';
  } catch {
    return true;
  }
}

export async function setScanSoundEnabled(enabled: boolean): Promise<void> {
  try {
    return await SecureStore.setItemAsync(STORAGE_KEYS.SCAN_SOUND_ENABLED, String(enabled));
  } catch {
    // Silently fail if secure store is unavailable
  }
}

export async function getHapticFeedbackEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(STORAGE_KEYS.HAPTIC_FEEDBACK_ENABLED);
    if (value === null) return true;
    return value === 'true';
  } catch {
    return true;
  }
}

export async function setHapticFeedbackEnabled(enabled: boolean): Promise<void> {
  try {
    return await SecureStore.setItemAsync(STORAGE_KEYS.HAPTIC_FEEDBACK_ENABLED, String(enabled));
  } catch {
    // Silently fail if secure store is unavailable
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Wipe all app-level secure storage (e.g. on logout). */
export async function clearAll(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.USER_EMAIL),
    SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ROLE),
    SecureStore.deleteItemAsync(STORAGE_KEYS.USER_PHOTO_URL),
    // API URL is intentionally kept so the user doesn't have to re-enter it
  ]);
}

