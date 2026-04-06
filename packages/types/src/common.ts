/**
 * 공통 API 응답 타입 정의
 */

/** API 에러 상세 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** 공통 API 응답 래퍼 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: ApiError;
}

/** 페이지네이션 응답 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Supabase Auth 기반 사용자 */
export interface User {
  id: string;
  email: string;
  createdAt: string;
}
