export const APP_NAME = 'Depo';
export const APP_VERSION = '1.0.0';

// API_URL is managed at runtime via expo-secure-store (see src/services/secureStorage.ts).
// Use getApiUrl() / setApiUrl() from @/services instead of reading an env var.
// Increased timeout for Android emulator which can be slower
export const API_TIMEOUT = 60000; // 60 seconds
