import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin, ensureBucketExists } from "@/lib/supabase";
import { getCollection } from "@/lib/db";
import type { UserDocument } from "@db/users";

// Use a dedicated avatars bucket, do not fall back to a global bucket
const BUCKET = process.env.SUPABASE_AVATARS_BUCKET || "pfp";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"]; 

function extForMime(m: string): string {
  switch (m) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const users = await getCollection<UserDocument>("users");
    const dbUser = await users.findOne({ email: session.user.email });
    const previousUrl = dbUser?.profile?.profileImageUrl || null;

    const sb = supabaseAdmin();
    await ensureBucketExists(BUCKET, true);
    const ext = file.name.includes(".") ? (file.name.split(".").pop() || extForMime(file.type)) : extForMime(file.type);
    const objectPath = `${session.user.id}/${Date.now()}.${ext}`;
    const arrayBuf = await file.arrayBuffer();

    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(objectPath, new Uint8Array(arrayBuf), {
        contentType: file.type,
        upsert: true,
      });
    if (uploadErr) {
      console.error("AVATAR_UPLOAD_ERROR", uploadErr);
      return NextResponse.json({ error: uploadErr.message || "Upload failed" }, { status: 500 });
    }

    const publicUrl = sb.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;

    // Remove previous image to avoid orphans (best-effort)
    if (previousUrl) {
      try {
        const url = new URL(previousUrl);
        const idx = url.pathname.indexOf(`/storage/v1/object/public/${BUCKET}/`);
        if (idx !== -1) {
          const key = url.pathname.substring(idx + `/storage/v1/object/public/${BUCKET}/`.length);
          await sb.storage.from(BUCKET).remove([key]);
        }
      } catch {}
    }

    await users.updateOne(
      { email: session.user.email },
      { $set: { "profile.profileImageUrl": publicUrl, "profile.profileImageName": file.name, updatedAt: new Date() } }
    );

    return NextResponse.json({ url: publicUrl });
  } catch (err: any) {
    console.error("AVATAR_ROUTE_ERROR", err);
    return NextResponse.json({ error: err?.message || "Internal Server Error" }, { status: 500 });
  }
}
