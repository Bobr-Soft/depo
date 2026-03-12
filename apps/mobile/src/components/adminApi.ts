/**
 * Admin API helpers — direct REST calls for admin-only screens.
 * All functions require an admin-role JWT; the server enforces this with
 * requireAdmin middleware and returns 403 when the caller is not an admin.
 */

import { buildApiUrl, getApiUrl, getToken } from '@/services/secureStorage';
import { reauthenticateSilently, logout } from '@/services/auth';
import type { User, TaskComplete } from '@/constants/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiItem {
  id: number;
  name: string;
  barcode: string | null;
  description: string | null;
  quantity: number;
  category_id: number | null;
  location_id: number | null;
  category: string | null;
  location: string | null;
}

export interface AdminUserResponse extends User {
  username?: string;
  isActive?: boolean;
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function adminFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const [apiUrl, storedToken] = await Promise.all([getApiUrl(), getToken()]);
  let token = storedToken;

  if (!token || !apiUrl) {
    throw new Error('Nem hitelesített – hiányzó token vagy API URL.');
  }

  const makeRequest = (tkn: string) =>
    fetch(buildApiUrl(apiUrl, path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tkn}`,
        ...options.headers,
      },
    });

  let response = await makeRequest(token);

  // Attempt silent re-auth on 401
  if (response.status === 401) {
    const reauth = await reauthenticateSilently();
    if (!reauth.success) {
      await logout();
      throw new Error('Lejárt munkamenet – kérjük, jelentkezzen be újra.');
    }
    const newToken = reauth.token ?? (await getToken());
    if (!newToken) {
      await logout();
      throw new Error('Lejárt munkamenet – kérjük, jelentkezzen be újra.');
    }
    token = newToken;
    response = await makeRequest(token);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `HTTP ${response.status}`);
  }

  return response;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function adminGetUsers(): Promise<AdminUserResponse[]> {
  const res = await adminFetch('/users');
  return res.json();
}

export async function adminCreateUser(
  email: string,
  role: string,
  isActive = true
): Promise<AdminUserResponse> {
  const res = await adminFetch('/users', {
    method: 'POST',
    body: JSON.stringify({ email, role, isActive }),
  });
  return res.json();
}

export async function adminUpdateUser(
  id: number,
  email: string,
  role: string,
  isActive: boolean
): Promise<AdminUserResponse> {
  const res = await adminFetch(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ email, role, isActive }),
  });
  return res.json();
}

export async function adminDeleteUser(id: number): Promise<void> {
  await adminFetch(`/users/${id}`, { method: 'DELETE' });
}

// ─── Items / Inventory ────────────────────────────────────────────────────────

export async function adminGetItems(): Promise<ApiItem[]> {
  const res = await adminFetch('/items');
  return res.json();
}

export async function adminUpdateItem(
  id: number,
  data: Partial<Omit<ApiItem, 'id' | 'category' | 'location'>>
): Promise<ApiItem> {
  const res = await adminFetch(`/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminDeleteItem(id: number): Promise<void> {
  await adminFetch(`/items/${id}`, { method: 'DELETE' });
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function adminGetTasks(): Promise<TaskComplete[]> {
  const res = await adminFetch('/tasks');
  return res.json();
}

// ─── Locations ──────────────────────────────────────────────────────────────

export interface WarehouseLocationApi {
  id: number;
  row_num: number;
  col_num: number;
  shelf_level: number;
  is_xl: number | boolean;
  location_code: string;
  is_active: number | boolean;
}

export async function adminGetLocations(): Promise<WarehouseLocationApi[]> {
  const res = await adminFetch('/locations');
  return res.json();
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface ApiCategory {
  id: number;
  name: string;
  description?: string | null;
  size_class?: string | null;
  min_stock_level?: number | null;
}

export async function adminGetCategories(): Promise<ApiCategory[]> {
  const res = await adminFetch('/categories');
  return res.json();
}

export async function adminCreateCategory(
  name: string,
  description?: string
): Promise<ApiCategory> {
  const res = await adminFetch('/categories', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
  return res.json();
}

export async function adminUpdateCategory(
  id: number,
  name: string,
  description?: string
): Promise<ApiCategory> {
  const res = await adminFetch(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description }),
  });
  return res.json();
}

export async function adminDeleteCategory(id: number): Promise<void> {
  await adminFetch(`/categories/${id}`, { method: 'DELETE' });
}

// ─── Item Create ──────────────────────────────────────────────────────────────

export async function adminCreateItem(
  data: Omit<ApiItem, 'id' | 'category' | 'location'>
): Promise<ApiItem> {
  const res = await adminFetch('/items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

// ─── Task mutations ───────────────────────────────────────────────────────────

export interface CreateTaskInput {
  name: string;
  type: 'picking' | 'inbound' | 'transfer';
  priority: number;
  deadline?: string | null;
  assigned_user?: number | null;
}

export async function adminCreateTask(data: CreateTaskInput): Promise<TaskComplete> {
  const res = await adminFetch('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminUpdateTask(
  id: number,
  data: Partial<{ name: string; priority: number; status: string; assigned_user: number | null; deadline: string | null }>
): Promise<TaskComplete> {
  const res = await adminFetch(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminDeleteTask(id: number): Promise<void> {
  await adminFetch(`/tasks/${id}`, { method: 'DELETE' });
}

export async function adminAcceptShortage(taskId: number, itemId: number): Promise<void> {
  await adminFetch(`/tasks/${taskId}/items/${itemId}/accept-shortage`, { method: 'PUT' });
}

// ─── Damage Reports ───────────────────────────────────────────────────────────

export interface DamageReport {
  id: number;
  reported_by: number;
  reporter_email?: string | null;
  item_barcode: string | null;
  item_name: string | null;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: number | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export async function adminGetDamageReports(): Promise<DamageReport[]> {
  const res = await adminFetch('/damage-reports');
  return res.json();
}

export async function adminUpdateDamageReportStatus(
  id: number,
  status: 'approved' | 'rejected',
  review_note?: string
): Promise<DamageReport> {
  const res = await adminFetch(`/damage-reports/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, review_note }),
  });
  return res.json();
}

// ─── Health / me ─────────────────────────────────────────────────────────────

export async function adminPingApi(): Promise<{ email: string; role: string }> {
  const res = await adminFetch('/me');
  const body = await res.json() as { user: { email: string; role: string } };
  return body.user;
}
