import { NextResponse } from 'next/server';

// GET /api/health: RTD 서버 헬스체크 (MCS 연결 상태 배지용)
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'RTD' });
}
