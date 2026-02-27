import * as SecureStore from 'expo-secure-store';

// All keys stored in the device's secure enclave
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  API_URL: 'api_url',
  USER_EMAIL: 'user_email',
  USER_ROLE: 'user_role',
  USER_PHOTO_URL: 'user_photo_url',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// Default to Render API, allow EXPO_PUBLIC_API_URL override at build time
const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://depo-tj5n.onrender.com';

// ─── Token ──────────────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
}

export async function setToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
}

export async function deleteToken(): Promise<void> {
  return SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
}

// ─── API URL ─────────────────────────────────────────────────────────────────

/**
 * Returns the stored API URL, or the compile-time default if none is saved.
 * Call setApiUrl() from a settings screen to override it at runtime.
 */
export async function getApiUrl(): Promise<string> {
  const stored = await SecureStore.getItemAsync(STORAGE_KEYS.API_URL);
  return stored ?? DEFAULT_API_URL;
}

export async function setApiUrl(url: string): Promise<void> {
  return SecureStore.setItemAsync(STORAGE_KEYS.API_URL, url);
}

// ─── User email ──────────────────────────────────────────────────────────────

export async function getUserEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.USER_EMAIL);
}

export async function setUserEmail(email: string): Promise<void> {
  return SecureStore.setItemAsync(STORAGE_KEYS.USER_EMAIL, email);
}

export async function deleteUserEmail(): Promise<void> {
  return SecureStore.deleteItemAsync(STORAGE_KEYS.USER_EMAIL);
}

// ─── User role ───────────────────────────────────────────────────────────────

export async function getUserRole(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.USER_ROLE);
}

export async function setUserRole(role: string): Promise<void> {
  return SecureStore.setItemAsync(STORAGE_KEYS.USER_ROLE, role);
}

export async function deleteUserRole(): Promise<void> {
  return SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ROLE);
}

export async function getUserPhotoUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.USER_PHOTO_URL);
}

export async function setUserPhotoUrl(photoUrl: string): Promise<void> {
  return SecureStore.setItemAsync(STORAGE_KEYS.USER_PHOTO_URL, photoUrl);
}

export async function deleteUserPhotoUrl(): Promise<void> {
  return SecureStore.deleteItemAsync(STORAGE_KEYS.USER_PHOTO_URL);
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

