import { TaskComplete } from '@/constants';
import { getApiUrl, getToken } from '@/services/secureStorage';
import { API_TIMEOUT } from '@/constants/config';

const DEV_BYPASS_TOKEN = 'dev-bypass-token';

/** Placeholder tasks used when running with the dev bypass (no real API needed). */
const DEV_MOCK_TASKS: TaskComplete[] = [
  {
    id: 1,
    name: 'Demo feladat #1',
    type: 'picking',
    source_id: 'SRC-001',
    assigned_user: 1,
    status: 'pending',
    priority: 1,
    deadline: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assigned_user_data: null,
    items: [],
  } as unknown as TaskComplete,
];

/**
 * Fetches all tasks for the authenticated user.
 * API URL and JWT are read from expo-secure-store — no .env required.
 * Falls back to mock data when the dev-bypass token is active.
 */
export default async function loadTasks(): Promise<TaskComplete[]> {
  try {
    const [apiUrl, token] = await Promise.all([getApiUrl(), getToken()]);

    if (!token) {
      console.warn('loadTasks: no auth token in secure storage');
      return [];
    }

    // Dev bypass — return mock data so the screen works without the API
    if (token === DEV_BYPASS_TOKEN) {
      console.warn('loadTasks: using dev bypass mock data');
      return DEV_MOCK_TASKS;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(`${apiUrl}/tasks`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('loadTasks: request timed out');
    } else {
      console.error('Failed to load tasks:', error);
    }
    return [];
  }
}
