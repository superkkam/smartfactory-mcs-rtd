import { test, expect } from '@playwright/test';

/**
 * Task 015~018: 시뮬레이션 흐름
 * /simulation → run → /simulation/result 폴링 흐름 검증
 */
test.describe('T015~018: 시뮬레이션 흐름', () => {
  test('시뮬레이션 페이지 렌더 및 폼 표시', async ({ page }) => {
    await page.goto('/simulation');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/캐리어|carrier/i).first()).toBeVisible();
    await expect(page.getByText(/반송 요청|request/i).first()).toBeVisible();
    await expect(page.getByText(/알고리즘|algorithm/i).first()).toBeVisible();
  });

  test('시뮬레이션 실행 → 진행 상태 표시', async ({ page }) => {
    await page.goto('/simulation');
    await page.waitForLoadState('networkidle');
    const startBtn = page.getByRole('button', { name: /시뮬레이션 시작|실행|시작/i });
    if (await startBtn.isEnabled()) {
      await startBtn.click();
      await expect(
        page.getByText(/진행|running|완료|completed|결과/i).first()
      ).toBeVisible({ timeout: 30_000 });
    }
  });

  test('시뮬레이션 결과 페이지 — 지표 또는 이력 렌더', async ({ page }) => {
    await page.goto('/simulation/result');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/결과|반송 시간|처리량|충돌|가동률|runId|이력/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('시뮬레이션 설정 페이지 렌더', async ({ page }) => {
    await page.goto('/simulation/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/설정|carrier|캐리어/i).first()).toBeVisible();
  });
});
