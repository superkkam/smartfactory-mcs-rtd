import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Supabase 세션 갱신 유틸리티 (RTD 앱 전용).
 * MCS 앱은 apps/mcs/proxy.ts 에서 독립적인 인증 미들웨어를 관리한다.
 * (Next.js 16 proxy 방식과 기존 middleware 방식의 차이로 각 앱이 별도 구현)
 */
export async function updateSession(request: NextRequest): Promise<Response> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 세션 갱신 (중요: getUser() 호출로 세션 쿠키 갱신)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RTD 앱용: 세션 갱신만 수행, 리다이렉트 로직 없음
  // MCS 리다이렉트는 apps/mcs/proxy.ts 참고
  if (!user) { /* 세션 없음 — RTD에서 처리 */ }

  return supabaseResponse;
}
