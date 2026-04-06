import { createServerClient } from '@supabase/ssr';
import { type ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

/**
 * 서버 컴포넌트 / Route Handler에서 Supabase 클라이언트를 생성합니다.
 * Next.js의 cookies() 함수 결과를 인자로 받습니다.
 */
export function createClient(cookieStore: ReadonlyRequestCookies) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              (cookieStore as any).set(name, value, options);
            });
          } catch {
            // 서버 컴포넌트에서는 쿠키 설정 불가 (미들웨어에서 처리됨)
          }
        },
      },
    }
  );
}
