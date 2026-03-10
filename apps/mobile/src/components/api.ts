import { TaskComplete } from '@/constants';
import { buildApiUrl, getApiUrl, getToken } from '@/services/secureStorage';
import { getTasksWithSync, forceRefresh, taskItemPicked } from '@/services/sync';
import { logout, reauthenticateSilently } from '@/services/auth';

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

/** Loads a single task by ID. Uses loadTasks under the hood, so it benefits from caching and dev bypass.
 */

export async function loadTask(id: number): Promise<TaskComplete | null> {
  try {
    const tasks = await loadTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      console.warn(`Task with id ${id} not found in loaded tasks`);
      return null;
    }
    return task;
  } catch (error) {
    console.error('Failed to load task:', error);
    return null;
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

export async function markTaskItemAsPicked(taskId: number, itemId: number, pickedQuantity: number): Promise<boolean> {
  try {
    const token = await getToken();

    if(!token) {
      console.warn('markTaskItemAsPicked: no auth token in secure storage');
      return false;
    }

    if (token === DEV_BYPASS_TOKEN) {
      console.warn('markTaskItemAsPicked: dev bypass - simulating successful API call');
      return true;
    }

    await taskItemPicked(taskId, itemId, pickedQuantity);
    return true;
  } catch (error) {
    console.error('Failed to mark task item as picked:', error);
    return false;
  }
}

async function mutateTaskAssignment(taskId: number, action: 'take' | 'release'): Promise<boolean> {
  try {
    const [storedToken, apiUrl] = await Promise.all([getToken(), getApiUrl()]);
    let token = storedToken;
    let retriedWithReauth = false;

    if (!token || !apiUrl) {
      console.warn(`${action}Task: missing auth token or API URL`);
      return false;
    }

    if (token === DEV_BYPASS_TOKEN) {
      console.warn(`${action}Task: dev bypass - simulating success`);
      return true;
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(buildApiUrl(apiUrl, `/tasks/${taskId}/${action}`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return true;
      }

      const errorText = await response.text().catch(() => 'Unknown error');

      if ((response.status === 401 || response.status === 403) && !retriedWithReauth) {
        const reauthResult = await reauthenticateSilently();
        if (!reauthResult.success) {
          await logout();
          return false;
        }

        const refreshedToken = reauthResult.token ?? await getToken();
        if (!refreshedToken) {
          await logout();
          return false;
        }

        token = refreshedToken;
        retriedWithReauth = true;
        continue;
      }

      console.error(`${action}Task failed:`, response.status, errorText);
      return false;
    }

    return false;
  } catch (error) {
    console.error(`Failed to ${action} task:`, error);
    return false;
  }
}

export async function takeTask(taskId: number): Promise<boolean> {
  return mutateTaskAssignment(taskId, 'take');
}

export async function releaseTask(taskId: number): Promise<boolean> {
  return mutateTaskAssignment(taskId, 'release');
}
