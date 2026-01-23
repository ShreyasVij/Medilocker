import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { callExtract, callExtractMulti } from "@/services/aiClient";

// Ensure Node.js runtime so Buffer and server-side fetch behave consistently
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toBase64 = async (file: File) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const files = formData.getAll("files").filter((f) => f instanceof File) as File[];
  if (!file && files.length === 0) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    if (files.length > 0) {
      const parts = [] as { fileName: string; contentBase64: string }[];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const contentBase64 = await toBase64(f);
        parts.push({ fileName: f.name || `page-${i + 1}`, contentBase64 });
      }
      const result = await callExtractMulti({ files: parts });
      return NextResponse.json(result, { status: 200 });
    } else if (file) {
      const contentBase64 = await toBase64(file);
      const result = await callExtract({ fileName: file.name, contentBase64 });
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
  } catch (error: any) {
    const message = typeof error?.message === "string" ? error.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
