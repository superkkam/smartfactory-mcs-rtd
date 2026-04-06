import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { Providers } from '@/components/providers';

/** 앱 영역 레이아웃: 사이드바 + 헤더 + 콘텐츠 영역 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex h-screen overflow-hidden">
        {/* 좌측 고정 사이드바 */}
        <AppSidebar />

        {/* 우측 콘텐츠 영역 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  );
}
