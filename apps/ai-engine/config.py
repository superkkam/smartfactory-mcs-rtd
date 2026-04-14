"""
환경 변수 설정 (pydantic-settings)
.env 파일 또는 환경 변수에서 자동 로딩
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import json


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Supabase (service_role_key: RLS 우회, 서버 전용)
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # PPO 모델 경로 (학습 후 생성됨, 없으면 A* 폴백)
    model_path: str = "trained_models/ppo_route.zip"

    # CORS 허용 오리진 (JSON 배열 문자열 또는 콤마 구분)
    cors_origins: str = '["http://localhost:3000"]'

    # 캐리어 이동 속도 (m/s) — 시뮬레이션용
    carrier_speed: float = 0.3

    def get_cors_origins(self) -> List[str]:
        """CORS 오리진 파싱 (JSON 배열 또는 콤마 구분 문자열)"""
        try:
            parsed = json.loads(self.cors_origins)
            return parsed if isinstance(parsed, list) else [self.cors_origins]
        except json.JSONDecodeError:
            return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
