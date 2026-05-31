import { NextResponse } from 'next/server';

/**
 * GET /api/mcs/ports
 * 브라우저 → RTD 서버 → MCS 서버 프록시 (CORS 우회)
 */
export async function GET() {
  const mcsBase = process.env.MCS_API_URL ?? 'http://localhost:3001';

  try {
    const res = await fetch(`${mcsBase}/api/equipment-units/ports`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'MCS 응답 오류' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'MCS 서버에 연결할 수 없습니다' }, { status: 503 });
  }
}
