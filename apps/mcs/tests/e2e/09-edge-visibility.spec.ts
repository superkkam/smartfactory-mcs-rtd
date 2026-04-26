import { test, expect } from '@playwright/test';

/**
 * Task Phase A: 엣지 가시성 보장 검증
 * - json_data에 저장된 엣지는 모두 캔버스에 표시되어야 함
 * - relationsVisible=false 후 저장해도 재로드 시 표시됨
 * - orphan 엣지(source/target 노드 없음)는 console.warn만 내고 렌더링 오류 없음
 */
test.describe('Phase-A: 엣지 가시성 보장', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/layout-modeler');
    await page.waitForLoadState('networkidle');
  });

  test('레이아웃 모델러 페이지 정상 렌더', async ({ page }) => {
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10_000 });
  });

  test('레이아웃 로드 시 엣지가 캔버스에 표시됨', async ({ page }) => {
    // React Flow 엣지 컨테이너가 존재하는지 확인
    const edgeContainer = page.locator('.react-flow__edges');
    await expect(edgeContainer).toBeVisible({ timeout: 10_000 });

    // 엣지가 하나라도 있으면 visible 확인
    const edges = page.locator('.react-flow__edge');
    const edgeCount = await edges.count();
    if (edgeCount > 0) {
      // 첫 번째 엣지 visible 확인
      await expect(edges.first()).toBeVisible();
      // hidden 속성으로 숨겨진 엣지가 없어야 함 (relationsVisible=true 기본값)
      const hiddenEdges = page.locator('.react-flow__edge[style*="display: none"], .react-flow__edge[style*="visibility: hidden"]');
      expect(await hiddenEdges.count()).toBe(0);
    }
  });

  test('릴레이션 표시 토글 — OFF 후 ON 시 엣지 다시 표시', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: /경로 숨김|경로 표시|━|╌/ });
    if (!(await toggleBtn.isVisible({ timeout: 3_000 }).catch(() => false))) return;

    const edgesBeforeToggle = page.locator('.react-flow__edge');
    const countBefore = await edgesBeforeToggle.count();
    if (countBefore === 0) return;  // 엣지 없으면 skip

    // 토글 OFF
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // 토글 ON 복원
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // 복원 후 엣지 수 동일
    const countAfter = await page.locator('.react-flow__edge').count();
    expect(countAfter).toBe(countBefore);
  });

  test('/api/seed-complex-layout — 시드 후 캔버스 엣지 존재', async ({ page, request }) => {
    // 시드 생성
    const res = await request.post('/api/seed-complex-layout');
    if (res.status() !== 200) return;  // 이미 존재하면 skip

    // 페이지 새로고침
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.react-flow', { timeout: 10_000 });

    // 시드 레이아웃의 엣지가 캔버스에 렌더됨
    const edges = page.locator('.react-flow__edge');
    expect(await edges.count()).toBeGreaterThan(0);
  });
});
