import { test, expect } from '@playwright/test';

/**
 * Task 022: RTD-MCS 통합 — 활성 모드
 * 로컬 실행 시: E2E_RTD_ENABLED=true 환경변수 설정 필요
 */
test.describe('T022: RTD 활성 모드', () => {
  test.skip(
    process.env.E2E_RTD_ENABLED !== 'true',
    'RTD 활성 모드 테스트는 E2E_RTD_ENABLED=true 필요'
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/transfer-control');
    await page.waitForLoadState('networkidle');
  });

  test('RtdStatusBadge — 헬스체크 상태 표시', async ({ page }) => {
    await expect(
      page.getByText(/연결|connected|오류|error|헬스/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('/api/rtd/health 엔드포인트 응답', async ({ request }) => {
    const res = await request.get('/api/rtd/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });

  test('/api/rtd/trigger — LOAD_REQUEST 시뮬레이션', async ({ request }) => {
    const res = await request.post('/api/rtd/trigger', {
      data: {
        carrierIds: ['test-carrier-001'],
        sourceEquipmentId: 'stk-001',
        destEquipmentId: 'proc-001',
      },
    });
    expect([200, 201, 400]).toContain(res.status());
  });

  test('/api/commands/create — MacroCommand 수동 생성 API', async ({ request }) => {
    const res = await request.post('/api/commands/create', {
      data: {
        sourceUnitId: 'stk-001-port-1',
        destUnitId: 'proc-001-port-1',
        sourceSystem: 'MANUAL',
      },
    });
    expect([200, 201, 400, 422]).toContain(res.status());
  });
});
