export const APP_NAME = 'Depo';
export const APP_VERSION = '1.0.0';

// API_URL is managed at runtime via expo-secure-store (see src/services/secureStorage.ts).
// Use getApiUrl() / setApiUrl() from @/services instead of reading an env var.
// Increased timeout for Android emulator and Render cold starts
export const API_TIMEOUT = 90000; // 90 seconds

// Retry configuration for failed requests
export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
  backoffMultiplier: 2, // exponential backoff
};
