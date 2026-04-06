import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Supabase 세션을 갱신하고 인증 보호 프록시를 처리합니다.
 * Task 012에서 실제 리다이렉트 로직이 활성화됩니다.
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

  // TODO: Task 012에서 활성화 — 비로그인 시 /login 리다이렉트
  // const { pathname } = request.nextUrl;
  // const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');
  // if (!user && !isAuthRoute) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = '/login';
  //   return NextResponse.redirect(url);
  // }

  return supabaseResponse;
}
