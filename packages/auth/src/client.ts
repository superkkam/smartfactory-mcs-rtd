import { createBrowserClient } from '@supabase/ssr';

/**
 * 브라우저 환경에서 Supabase 클라이언트를 생성합니다.
 * 싱글턴 패턴으로 동일 인스턴스를 재사용합니다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
