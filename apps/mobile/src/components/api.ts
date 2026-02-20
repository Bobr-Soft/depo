import { TaskComplete } from '@/constants';
import { getToken } from '@/services/secureStorage';
import { getTasksWithSync, forceRefresh } from '@/services/sync';

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
 * Fetches all tasks with offline support.
 * Returns cached data immediately and syncs in background if online.
 * Falls back to mock data when the dev-bypass token is active.
 */
export default async function loadTasks(): Promise<TaskComplete[]> {
  try {
    const token = await getToken();

    if (!token) {
      console.warn('loadTasks: no auth token in secure storage');
      return [];
    }

    // Dev bypass — return mock data so the screen works without the API
    if (token === DEV_BYPASS_TOKEN) {
      console.warn('loadTasks: using dev bypass mock data');
      return DEV_MOCK_TASKS;
    }

    // Use sync service for offline-first approach
    const { tasks } = await getTasksWithSync();
    return tasks;
  } catch (error) {
    console.error('Failed to load tasks:', error);
    return [];
  }
}

/**
 * Force refresh tasks from server
 */
export async function refreshTasks(): Promise<TaskComplete[]> {
  try {
    const token = await getToken();

    if (!token) {
      console.warn('refreshTasks: no auth token in secure storage');
      return [];
    }

    if (token === DEV_BYPASS_TOKEN) {
      return DEV_MOCK_TASKS;
    }

    const result = await forceRefresh();
    return result.tasks || [];
  } catch (error) {
    console.error('Failed to refresh tasks:', error);
    return [];
  }
}
