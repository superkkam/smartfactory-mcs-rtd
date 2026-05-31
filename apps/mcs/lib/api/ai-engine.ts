/**
 * FastAPI AI 엔진 클라이언트
 * 브라우저 → http://localhost:8000 직접 호출 (CORS 허용)
 * TanStack Query 훅 포함
 */
import { useQuery } from '@tanstack/react-query';
import type {
  InferenceRequest,
  InferenceResponse,
  SimulationRunRequest,
  SimulationRunResponse,
  SimulationStatusResponse,
  SimulationResultResponse,
} from '@workspace/types/mcs';

const AI_ENGINE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_AI_ENGINE_URL) ||
  'http://localhost:8000';

/** 저수준 fetch 헬퍼 (오류 시 Error throw) */
async function aiEngineFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${AI_ENGINE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI 엔진 오류 ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── 추론 ─────────────────────────────────────────────────────────

/** PPO 경로 추론 (모델 미존재 시 A* 폴백) */
export async function inferRoute(req: InferenceRequest): Promise<InferenceResponse> {
  return aiEngineFetch<InferenceResponse>('/api/inference', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// ── 시뮬레이션 ──────────────────────────────────────────────────

/** 시뮬레이션 실행 시작 — 즉시 runId 반환 */
export async function runSimulation(req: SimulationRunRequest): Promise<SimulationRunResponse> {
  return aiEngineFetch<SimulationRunResponse>('/api/simulation/run', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/**
 * 시뮬레이션 진행 상태 폴링 훅
 * Completed / Failed 상태가 되면 refetch 자동 중단
 */
export function useSimulationStatus(runId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['simulation_status', runId],
    queryFn: () =>
      aiEngineFetch<SimulationStatusResponse>(`/api/simulation/status/${runId}`),
    enabled: enabled && !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'Completed' || status === 'Failed') return false;
      return 1500;
    },
  });
}

/**
 * 시뮬레이션 결과 조회 훅
 * runId가 있을 때만 활성화 (결과 페이지에서 직접 호출 용도)
 */
export function useSimulationResult(runId: string | null) {
  return useQuery({
    queryKey: ['simulation_result', runId],
    queryFn: () =>
      aiEngineFetch<SimulationResultResponse>(`/api/simulation/result/${runId}`),
    enabled: !!runId,
    staleTime: Infinity,
  });
}

// ── Playground ───────────────────────────────────────────────────────

export type PlaygroundAlgorithm = 'astar' | 'ai_ppo' | 'cbs_ts' | 'prioritized';

export interface PlaygroundRequest {
  grid_size: number;
  obstacles: [number, number][];
  starts: [number, number][];
  goals: [number, number][];
  algorithm: PlaygroundAlgorithm;
}

export interface AgentPath {
  agent_id: string;
  path: [number, number][];
}

export interface PlaygroundResponse {
  agent_paths: AgentPath[];
  cost: number;
  makespan: number;
  conflict_count: number;
  runtime_ms: number;
  fallback: boolean;
}

/** 알고리즘 Playground 즉석 경로 계산 */
export async function solvePlayground(req: PlaygroundRequest): Promise<PlaygroundResponse> {
  return aiEngineFetch<PlaygroundResponse>('/api/playground/solve', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}
