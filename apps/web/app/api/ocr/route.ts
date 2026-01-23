import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getIdentity } from '@/lib/auth';
import type { OcrOutputDocument } from '@/../../packages/db/ocrOutputs';

export async function GET(request: NextRequest) {
  try {
    const { role } = await getIdentity();
    if (role === 'guest') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const ocrCol = await getCollection<OcrOutputDocument>('ocrOutputs');
    const ocr = await ocrCol.findOne({ id } as any);
    
    if (!ocr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ text: ocr.text || '' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
