'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** MCS 앱 상단 헤더 컴포넌트 */
export function AppHeader() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* 좌측: 페이지 제목 영역 */}
      <div />

      {/* 우측: 사용자 영역 */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">MCS 플랫폼</span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
