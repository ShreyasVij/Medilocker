// RBAC permission matrix aligned to roles.
export type Role = 'patient' | 'guardian' | 'doctor' | 'admin' | 'system-worker';

// Permission keys used across the app
// profile:read, profile:write, document:read, document:upload, document:delete,
// alerts:manage, share:create, share:revoke, admin:db:init
export const rolePermissions: Record<Role, string[]> = {
  patient: [
    'profile:read', 'profile:write',
    'document:read', 'document:upload', 'document:delete',
    'alerts:manage', 'share:create', 'share:revoke',
  ],
  guardian: [
    'profile:read',
    'document:read', 'document:upload',
    'alerts:manage',
  ],
  doctor: [
    'profile:read', 'document:read',
  ],
  admin: [
    'profile:read', 'profile:write',
    'document:read', 'document:upload', 'document:delete',
    'alerts:manage', 'share:create', 'share:revoke',
    'admin:db:init',
  ],
  'system-worker': [
    'document:read', 'document:upload'
  ],
};

export function hasPermission(role: Role, permission: string): boolean {
  return rolePermissions[role]?.includes(permission) === true;
}
