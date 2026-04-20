export type UserRole = 'admin' | 'supervisor' | 'worker';

export function normalizeUserRole(role?: string | null): UserRole {
  const normalized = String(role ?? '').trim().toLowerCase();

  if (normalized === 'admin') {
    return 'admin';
  }

  if (normalized === 'supervisor') {
    return 'supervisor';
  }

  if (normalized === 'worker') {
    return 'worker';
  }

  // Backwards compatibility: earlier builds used "Teacher" for non-admin users
  if (normalized === 'teacher') {
    return 'worker';
  }

  return 'worker';
}

export function isApproverRole(role: UserRole): boolean {
  return role === 'admin' || role === 'supervisor';
}
