import { NextRequest, NextResponse } from 'next/server';
import { getIdentity } from '@/lib/auth';
import { getCollection } from '@/lib/db';
import { callSummarize } from '@/services/aiClient';

export async function POST(request: NextRequest) {
  try {
    const { role } = await getIdentity();
    if (role === 'guest') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const documentId = body?.documentId as string;
    const structured = body?.structured as any;
    if (!documentId || !structured) {
      return NextResponse.json({ error: 'Missing documentId or structured' }, { status: 400 });
    }

    const summary = await callSummarize({ structuredData: structured }).catch((e: any) => {
      return { error: e?.message || 'Summarization failed' };
    });
    if ((summary as any)?.error) {
      return NextResponse.json(summary, { status: 500 });
    }

    // Expect an object: { summary: { ...structured... } }
    let content: any = (summary as any)?.summary ?? summary;
    // If a string slipped through, attempt to parse JSON
    if (typeof content === 'string') {
      try { content = JSON.parse(content); } catch {}
      // Wrap markdown string into structured shape for consistency
      if (typeof content === 'string') {
        content = { in_depth_summary: content, key_findings: [], recommendations: [], possible_follow_ups: [], lifestyle_advice: [], disclaimer: "This content is informational only. For proper follow-ups, contact a licensed medical practitioner." };
      }
    }

    const summariesCol = await getCollection<any>('summaries');
    await summariesCol.updateOne(
      { documentId, type: 'doc' } as any,
      { $set: { documentId, type: 'doc', content, updatedAt: new Date() } } as any,
      { upsert: true } as any
    );
    return NextResponse.json({ ok: true, summary: content });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
