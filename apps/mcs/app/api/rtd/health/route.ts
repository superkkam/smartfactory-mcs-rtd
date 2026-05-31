import { NextResponse } from 'next/server';

// GET /api/rtd/health: RTD 연결 상태 확인 (클라이언트 배지 폴링용)
export async function GET() {
  const enabled = process.env.NEXT_PUBLIC_RTD_ENABLED === 'true';

  if (!enabled) {
    return NextResponse.json({ enabled: false, reachable: false, latencyMs: null });
  }

  const rtdUrl = process.env.RTD_API_URL;
  if (!rtdUrl) {
    return NextResponse.json({ enabled: true, reachable: false, latencyMs: null, error: 'RTD_API_URL 미설정' });
  }

  const start = Date.now();
  try {
    const res = await fetch(`${rtdUrl.replace(/\/$/, '')}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const latencyMs = Date.now() - start;
    return NextResponse.json({ enabled: true, reachable: res.ok, latencyMs });
  } catch {
    return NextResponse.json({ enabled: true, reachable: false, latencyMs: null });
  }
}
