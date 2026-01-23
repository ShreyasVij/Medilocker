import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client for Storage operations
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getPublicUrl(bucket: string, path: string) {
  const client = supabaseAdmin();
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function ensureBucketExists(bucket: string, publicRead = true) {
  const client = supabaseAdmin();
  // Try to get bucket info
  const info = await client.storage.getBucket(bucket);
  if (info.error) {
    // If not found, create it
    await client.storage.createBucket(bucket, { public: publicRead });
  }
}
