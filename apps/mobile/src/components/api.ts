import { TaskComplete } from '@/constants';
import { buildApiUrl, getApiUrl, getToken } from '@/services/secureStorage';
import { getTasksWithSync, forceRefresh, refreshTaskById, taskItemPicked } from '@/services/sync';
import { logout, reauthenticateSilently } from '@/services/auth';

const DEV_BYPASS_TOKEN = 'dev-bypass-token';

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

export default async function loadTasks(): Promise<TaskComplete[]> {
  try {
    const token = await getToken();

    if (!token) {
      console.warn('loadTasks: no auth token in secure storage');
      return [];
    }

    if (token === DEV_BYPASS_TOKEN) {
      return DEV_MOCK_TASKS;
    }

    const { tasks } = await getTasksWithSync();
    return tasks;
  } catch (error) {
    console.error('Failed to load tasks:', error);
    return [];
  }
}

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

export async function refreshTask(id: number): Promise<TaskComplete | null> {
  try {
    const token = await getToken();

    if (!token) {
      console.warn('refreshTask: no auth token in secure storage');
      return null;
    }

    if (token === DEV_BYPASS_TOKEN) {
      return DEV_MOCK_TASKS.find((task) => task.id === id) ?? null;
    }

    const result = await refreshTaskById(id);
    return result.task ?? null;
  } catch (error) {
    console.error('Failed to refresh task:', error);
    return null;
  }
}

export async function markTaskItemAsPicked(taskId: number, itemId: number, pickedQuantity: number): Promise<boolean> {
  try {
    const token = await getToken();

    if (!token) {
      console.warn('markTaskItemAsPicked: no auth token in secure storage');
      return false;
    }

    if (token === DEV_BYPASS_TOKEN) {
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

      const errorText = await response.text().catch(() => 'Unknown error');
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

/**
 * Requests a putaway location allocation from the backend.
 * Automatically handles token refresh loops.
 */
export async function allocatePutaway(barcode: string, quantity: number, isXl: boolean): Promise<string | null> {
  try {
    const [storedToken, apiUrl] = await Promise.all([getToken(), getApiUrl()]);
    let token = storedToken;
    let retriedWithReauth = false;

    if (!token || !apiUrl) {
      throw new Error('Missing auth token or API URL');
    }

    if (token === DEV_BYPASS_TOKEN) {
      return "01-01-01"; // Mock location
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(buildApiUrl(apiUrl, '/inbound/putaway'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barcode, quantity, isXl }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.location_code;
      }

      if ((response.status === 401 || response.status === 403) && !retriedWithReauth) {
        const reauthResult = await reauthenticateSilently();
        if (!reauthResult.success) {
          await logout();
          throw new Error('Authentication failed');
        }

        const refreshedToken = reauthResult.token ?? await getToken();
        if (!refreshedToken) {
          await logout();
          throw new Error('Failed to retrieve token after reauth');
        }

        token = refreshedToken;
        retriedWithReauth = true;
        continue;
      }

      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Allocation failed: ${response.status} - ${errorText}`);
    }

    return null;
  } catch (error) {
    console.error('Failed to allocate putaway location:', error);
    throw error;
  }
}
