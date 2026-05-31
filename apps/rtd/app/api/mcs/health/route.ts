import { NextResponse } from 'next/server';

export async function GET() {
  const mcsUrl = process.env.MCS_API_URL;
  if (!mcsUrl) {
    return NextResponse.json({ connected: false, reason: 'MCS_API_URL 미설정' }, { status: 200 });
  }

  try {
    const res = await fetch(`${mcsUrl}/api/rtd/health`, {
      signal: AbortSignal.timeout(4000),
    });
    return NextResponse.json({ connected: res.ok }, { status: 200 });
  } catch {
    return NextResponse.json({ connected: false }, { status: 200 });
  }
}
