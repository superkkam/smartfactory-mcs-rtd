"""
Supabase Python 클라이언트 싱글턴
service_role_key를 사용하여 RLS 우회 (서버 전용)
"""
from supabase import create_client, Client
from config import settings

_client: Client | None = None


def get_supabase() -> Client:
    """Supabase 클라이언트 싱글턴 반환"""
    global _client
    if _client is None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError(
                "SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다."
            )
        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client


def check_connection() -> bool:
    """Supabase 연결 상태 확인"""
    try:
        client = get_supabase()
        # 간단한 쿼리로 연결 확인
        client.table("mcs_layout").select("id").limit(1).execute()
        return True
    except Exception:
        return False
