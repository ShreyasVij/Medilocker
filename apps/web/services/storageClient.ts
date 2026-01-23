// Supabase Storage client helpers.
import { createClient } from '@supabase/supabase-js';

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function ensureBucketExists(bucketName: string) {
  const sb = supabaseAdmin();
  // Try to get the bucket; if missing, create it.
  const { data, error } = await sb.storage.getBucket(bucketName);
  if (!error && data) return true;
  const { error: createErr } = await sb.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: '50MB',
  });
  if (createErr) throw new Error(`Bucket ensure failed: ${createErr.message}`);
  return true;
}

export async function ensureUserSpace(params: { bucket?: string; actorId: string }) {
  const bucket = params.bucket || process.env.SUPABASE_BUCKET || 'medilocker';
  await ensureBucketExists(bucket);
  const sb = supabaseAdmin();
  // Create a lightweight placeholder to initialize the user's root path.
  const placeholder = new Blob([''], { type: 'text/plain' });
  await sb.storage.from(bucket).upload(`raw/${params.actorId}/.init`, placeholder, { upsert: true });
}

export async function uploadFile(params: { bucket?: string; storageKey: string; file: File | Blob }) {
  const bucket = params.bucket || process.env.SUPABASE_BUCKET || 'medilocker';
  const sb = supabaseAdmin();
  await ensureBucketExists(bucket);
  const { data, error } = await sb.storage.from(bucket).upload(params.storageKey, params.file, {
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return data;
}

export async function createDownloadUrl(params: { bucket?: string; storageKey: string; expiresIn?: number }) {
  const bucket = params.bucket || process.env.SUPABASE_BUCKET || 'medilocker';
  const expiresIn = params.expiresIn ?? 60; // seconds
  const sb = supabaseAdmin();
  await ensureBucketExists(bucket);
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(params.storageKey, expiresIn);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

export async function deleteStorageObjects(params: { bucket?: string; keys: string[] }) {
  const bucket = params.bucket || process.env.SUPABASE_BUCKET || 'medilocker';
  const sb = supabaseAdmin();
  await ensureBucketExists(bucket);
  if (!params.keys || params.keys.length === 0) return { deleted: 0 } as any;
  const { error } = await sb.storage.from(bucket).remove(params.keys);
  if (error) throw new Error(`Delete storage objects failed: ${error.message}`);
  return { deleted: params.keys.length } as any;
}

export async function listFiles(params: { bucket?: string; prefix: string }) {
  const bucket = params.bucket || process.env.SUPABASE_BUCKET || 'medilocker';
  const sb = supabaseAdmin();
  await ensureBucketExists(bucket);
  const prefix = params.prefix.replace(/\/$/, '');
  const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`List failed: ${error.message}`);
  return (data || []).map((obj: any) => `${prefix}/${obj.name}`);
}

export async function createDownloadUrlsForPrefix(params: { bucket?: string; prefix: string; expiresIn?: number }) {
  const bucket = params.bucket || process.env.SUPABASE_BUCKET || 'medilocker';
  const sb = supabaseAdmin();
  await ensureBucketExists(bucket);
  const keys = await listFiles({ bucket, prefix: params.prefix });
  const expiresIn = params.expiresIn ?? 60;
  const urls: string[] = [];
  for (const key of keys) {
    const { data, error } = await sb.storage.from(bucket).createSignedUrl(key, expiresIn);
    if (error) throw new Error(`Signed URL failed: ${error.message}`);
    urls.push(data.signedUrl);
  }
  return urls;
}
