// Permission checks for resource-level and share-scoped access.
import { getCollection } from '@/lib/db';
import type { ShareDocument } from '@/../../packages/db/shares';
import type { ProfileDocument } from '@/../../packages/db/profiles';
import type { DocumentDocument } from '@/../../packages/db/documents';
import { hasPermission, Role } from '@/../../packages/auth/rbac';

async function hasActiveShare(params: { profileId: string; actorId: string; permission?: 'view' | 'upload' | 'summary'; docId?: string }) {
  const sharesCol = await getCollection<ShareDocument>('shares');
  const q: any = {
    profileId: params.profileId,
    status: 'active',
    $or: [{ grantedToUserId: params.actorId }, { grantedToEmail: { $exists: true } }],
  };
  const shares = await sharesCol.find(q).toArray();
  for (const s of shares) {
    if (params.permission && !s.permissions.includes(params.permission)) continue;
    if (params.docId && s.scope?.docIds && !s.scope.docIds.includes(params.docId)) continue;
    return true;
  }
  return false;
}

export async function canAccessProfile(params: { role: Role; profileId: string; actorId: string }) {
  if (params.role === 'admin') return true;
  const profilesCol = await getCollection<ProfileDocument>('profiles');
  const profile = await profilesCol.findOne({ id: params.profileId });
  if (!profile) return false;
  if (params.role === 'patient' && profile.userId === params.actorId) return true;
  if (params.role === 'guardian' && (profile.guardians || []).some(g => g.userId === params.actorId)) return true;
  if (params.role === 'doctor') return hasActiveShare({ profileId: params.profileId, actorId: params.actorId, permission: 'view' });
  return false;
}

export function canPerformEmergencyAccess(params: { token: string }) {
  return params.token === 'emergency-demo-token';
}

export async function canUploadDocument(params: { role: Role; profileId: string; actorId: string }) {
  if (!hasPermission(params.role, 'document:upload')) return false;
  if (params.role === 'admin') return true;
  if (params.role === 'patient') {
    const profilesCol = await getCollection<ProfileDocument>('profiles');
    const p = await profilesCol.findOne({ id: params.profileId });
    return !!p && p.userId === params.actorId;
  }
  if (params.role === 'guardian') {
    const profilesCol = await getCollection<ProfileDocument>('profiles');
    const p = await profilesCol.findOne({ id: params.profileId });
    return !!p && (p.guardians || []).some(g => g.userId === params.actorId);
  }
  if (params.role === 'doctor') {
    return hasActiveShare({ profileId: params.profileId, actorId: params.actorId, permission: 'upload' });
  }
  return false;
}

export async function canDeleteDocument(params: { role: Role; docId: string; actorId: string }) {
  if (!hasPermission(params.role, 'document:delete')) return false;
  if (params.role === 'admin') return true;
  const docsCol = await getCollection<DocumentDocument>('documents');
  const doc = await docsCol.findOne({ id: params.docId });
  if (!doc) return false;
  return doc.ownerUserId === params.actorId;
}

export async function canDownloadDocument(params: { role: Role; docId: string | null; profileId?: string; actorId: string }) {
  if (!hasPermission(params.role, 'document:read')) return false;
  if (params.role === 'admin') return true;
  if (params.docId) {
    const docsCol = await getCollection<DocumentDocument>('documents');
    const doc = await docsCol.findOne({ id: params.docId });
    if (!doc) return false;
    if (doc.ownerUserId === params.actorId) return true;
    return hasActiveShare({ profileId: doc.profileId, actorId: params.actorId, permission: 'view', docId: params.docId });
  }
  if (params.profileId) {
    return canAccessProfile({ role: params.role, profileId: params.profileId, actorId: params.actorId });
  }
  return false;
}
