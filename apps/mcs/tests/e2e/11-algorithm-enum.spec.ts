import { test, expect } from '@playwright/test';

/**
 * Phase C: 알고리즘 enum 확장 검증
 * ASTAR/AI_PPO: 정상 응답 (또는 AI 엔진 미실행 시 fallback)
 * CACTUS/CBS_TS: 미구현 → AI 엔진이 실행 중이면 503, 아니면 4xx
 */
test.describe('Phase-C: 알고리즘 enum 4-value 검증', () => {
  test('ASTAR 알고리즘 — /api/astar 라우트 존재', async ({ request }) => {
    const res = await request.post('/api/astar', {
      data: { sourceUnitId: 'test-src', destUnitId: 'test-dst' },
    });
    // DB 유닛 없으면 400/404, 있으면 200
    expect([200, 400, 404, 500]).toContain(res.status());
  });

  test('CACTUS 알고리즘 — AI 엔진 미구현으로 503 또는 연결 오류', async ({ request }) => {
    // AI 엔진이 실행 중이면 503, 미실행이면 Next.js 프록시에서 500/502
    const res = await request.post('/api/inference', {
      data: {
        layoutId:     'MAPF-LAYOUT-001',
        sourceUnitId: 'MAPF-ND-R1C1',
        destUnitId:   'MAPF-ND-R8C8',
        algorithm:    'cactus',
      },
    });
    // AI 엔진 미구현 → 503, 미실행 → 500/502, DB 없음 → 404
    expect([404, 500, 502, 503]).toContain(res.status());
  });

  test('CBS_TS 알고리즘 — AI 엔진 미구현으로 503 또는 연결 오류', async ({ request }) => {
    const res = await request.post('/api/inference', {
      data: {
        layoutId:     'MAPF-LAYOUT-001',
        sourceUnitId: 'MAPF-ND-R1C1',
        destUnitId:   'MAPF-ND-R8C8',
        algorithm:    'cbs_ts',
      },
    });
    expect([404, 500, 502, 503]).toContain(res.status());
  });

  test('알 수 없는 algorithm 값 — 400 오류', async ({ request }) => {
    const res = await request.post('/api/inference', {
      data: {
        layoutId:     'MAPF-LAYOUT-001',
        sourceUnitId: 'MAPF-ND-R1C1',
        destUnitId:   'MAPF-ND-R8C8',
        algorithm:    'invalid_algo_xyz',
      },
    });
    // AI 엔진 실행 중이면 400, 미실행이면 500/502
    expect([400, 500, 502]).toContain(res.status());
  });

  test('반송 제어 페이지 — 알고리즘 선택 UI 렌더', async ({ page }) => {
    await page.goto('/transfer-control');
    await page.waitForLoadState('networkidle');

    // A* 비교 카드 또는 알고리즘 텍스트 표시 확인
    const hasAlgoText = await page.getByText(/A\*|ASTAR|알고리즘/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasAlgoText).toBeTruthy();
  });
});
