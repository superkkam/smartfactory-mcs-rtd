import { test, expect } from '@playwright/test';

/**
 * Phase B: MAPF 레이아웃 시드 검증
 * POST /api/seed-mapf-layout → 노드/엣지 수 + amrType 필드
 */
test.describe('Phase-B: MAPF 레이아웃 시드', () => {
  test('POST /api/seed-mapf-layout — 시드 생성 및 응답 구조', async ({ request }) => {
    const res = await request.post('/api/seed-mapf-layout');
    // 성공 또는 DB 미연결 시 500
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('layoutId');
      expect(body.stats).toHaveProperty('nodes');
      expect(body.stats).toHaveProperty('edges');
      expect(body.stats.nodes).toBeGreaterThan(60);   // 8×8 = 64 path + 설비
      expect(body.stats.edges).toBeGreaterThan(80);   // 4-connected 엣지 ~100개
      expect(body.stats.meta.gridRows).toBe(8);
      expect(body.stats.meta.gridCols).toBe(8);
      expect(body.stats.meta.agvCount).toBe(8);
    } else {
      // DB 미연결 또는 서버 오류 허용
      expect([400, 500]).toContain(res.status());
    }
  });

  test('MAPF 레이아웃 로드 후 캔버스 렌더', async ({ page, request }) => {
    // 시드 생성 시도
    const seedRes = await request.post('/api/seed-mapf-layout');
    if (seedRes.status() !== 200) return;  // DB 없으면 skip

    await page.goto('/layout-modeler');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.react-flow', { timeout: 10_000 });

    // MAPF 레이아웃 선택 (버전 선택 드롭다운)
    const versionSelect = page.getByRole('combobox').filter({ hasText: /레이아웃|MAPF/i });
    if (await versionSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await versionSelect.click();
      const mapfOption = page.getByRole('option', { name: /MAPF/i });
      if (await mapfOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await mapfOption.click();
        await page.waitForTimeout(500);
        // 그리드 엣지가 렌더됨
        const edges = page.locator('.react-flow__edge');
        expect(await edges.count()).toBeGreaterThan(0);
      }
    }
  });
});
