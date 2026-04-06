/**
 * 인증 전용 레이아웃: 중앙 정렬 카드 형태
 * 사이드바/헤더 없이 로그인/회원가입 폼만 표시
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      {/* 앱 로고 */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600">
          <span className="text-xl font-bold text-white">M</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">MCS 물류 모델링 플랫폼</h1>
        <p className="text-sm text-gray-500">공장 물류 레이아웃 모델링 및 AI 경로 최적화</p>
      </div>

      {/* 폼 카드 영역 */}
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
