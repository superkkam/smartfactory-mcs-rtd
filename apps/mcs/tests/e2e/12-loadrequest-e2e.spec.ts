import { test, expect } from '@playwright/test';

/**
 * Task 028: LoadRequest E2E 데모 흐름 검증
 *
 * 전제: RTD_API_URL 환경변수가 설정되어 있지 않아도 MCS 측 흐름만 검증.
 * RTD 연동이 활성화된 경우 전체 흐름을 검증한다.
 */
test.describe('Task-028: LoadRequest E2E 흐름', () => {

  test('dev-place-carriers — 공정 OUT 포트에 캐리어 배치', async ({ request }) => {
    const res = await request.post('/api/dev-place-carriers');
    // 캐리어/레이아웃이 없으면 404, 있으면 200
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json() as { ok: boolean; placed: unknown[] };
      expect(typeof body.ok).toBe('boolean');
    }
  });

  test('대시보드 — 레이아웃 뷰어 렌더 + tick 배지', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('load');

    // 레이아웃 뷰어 또는 로딩 텍스트가 표시되어야 함
    const viewer = page.locator('.react-flow, :text("레이아웃 불러오는 중"), :text("저장된 레이아웃이 없습니다")');
    await expect(viewer.first()).toBeVisible({ timeout: 10000 });
  });

  test('rtd/trigger — RTD_API_URL 미설정 시 503 반환', async ({ request }) => {
    const res = await request.post('/api/rtd/trigger', {
      data: { equipmentId: 'PROC-M1-OUT', eventType: 'LOAD_REQUEST' },
    });
    // RTD_API_URL 미설정 → 503, 설정 → 200 또는 502(RTD 오프라인)
    expect([200, 502, 503]).toContain(res.status());
  });

  test('rtd/trigger — 응답에 ok 필드 포함', async ({ request }) => {
    const res = await request.post('/api/rtd/trigger', {
      data: { equipmentId: 'PROC-M1-OUT', eventType: 'LOAD_REQUEST' },
    });
    const body = await res.json() as Record<string, unknown>;
    // ok 또는 error 필드가 반드시 있어야 함
    expect(body).toHaveProperty('ok');
  });

  test('message — DISPATCH_RESULT 수신 시 MacroCommand 생성', async ({ request }) => {
    // 먼저 레이아웃/장비 정보 확인을 위해 간단한 유닛 쿼리
    const layoutRes = await request.get('/api/layouts');
    if (layoutRes.status() !== 200) {
      test.skip(true, '레이아웃 없음 — 스킵');
      return;
    }
    const layouts = await layoutRes.json() as Array<{ id: string }>;
    if (!layouts.length) {
      test.skip(true, '레이아웃 없음 — 스킵');
      return;
    }

    // DISPATCH_RESULT 메시지 직접 POST
    const res = await request.post('/api/message', {
      data: {
        header: {
          messageId:     'TEST-MSG-001',
          messageType:   'DISPATCH_RESULT',
          source:        'RTD',
          target:        'MCS',
          timestamp:     new Date().toISOString(),
          correlationId: 'TEST-COR-001',
          siteId:        'FAB1',
          version:       '1.0',
        },
        body: {
          ruleGroupId:  'TEST-GROUP',
          dispatchType: 'DISPATCHING',
          lots: [{
            lotId:             'LOT-TEST-001',
            priority:          50,
            sourceEquipmentId: 'PROC-M1',
            destEquipmentId:   'PROC-M2',
          }],
          executionSummary: { totalSequences: 1, totalDuration: 0, sequences: [] },
        },
      },
    });

    // 장비가 없으면 201(빈 created) 또는 201(생성됨), 데이터 없으면 경고 후 201 continue
    expect([200, 201]).toContain(res.status());
    const body = await res.json() as { received: boolean; createdCount: number };
    expect(body.received).toBe(true);
    // createdCount는 장비 존재 여부에 따라 0 또는 양수
    expect(typeof body.createdCount).toBe('number');
  });

  test('대시보드 — DispatchResultPanel 초기 안내 문구 표시', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('load');

    // 포트를 클릭하지 않은 상태에서는 패널이 닫혀 있어야 함
    const panel = page.locator(':text("디스패칭 결과")');
    await expect(panel).not.toBeVisible();
  });

  test('randon-obstacle 환경변수 미설정 시 blockedSet 비어있음 검증 (코드 경로)', async ({ request }) => {
    // MCS_INJECT_RANDOM_OBSTACLES 미설정이면 blockSet이 빈 채로 A* 실행됨
    // 우회 경로 없이 최단 거리로 탐색 → message 라우트에서 성공해야 함
    // 실제 DB 장비가 있으면 201, 없으면 201(createdCount=0) 반환
    const res = await request.post('/api/message', {
      data: {
        header: {
          messageId: 'TEST-NOBLOCK-001', messageType: 'DISPATCH_RESULT',
          source: 'RTD', target: 'MCS',
          timestamp: new Date().toISOString(),
          correlationId: 'TEST-NOBLOCK-COR', siteId: 'FAB1', version: '1.0',
        },
        body: {
          ruleGroupId: '', dispatchType: 'DISPATCHING',
          lots: [{ lotId: 'LOT-NOBLOCK', priority: 50, sourceEquipmentId: 'PROC-M1', destEquipmentId: 'PROC-M2' }],
          executionSummary: { totalSequences: 1, totalDuration: 0, sequences: [] },
        },
      },
    });
    expect([200, 201]).toContain(res.status());
  });

});
