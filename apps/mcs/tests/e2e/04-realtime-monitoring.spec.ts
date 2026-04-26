import { test, expect } from '@playwright/test';

/**
 * Task 020: Supabase Realtime 실시간 모니터링
 */
test.describe('T020: 실시간 모니터링 (대시보드)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('대시보드 페이지 렌더', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
    await expect(
      page.locator('.react-flow, [data-testid="layout-viewer"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('레이아웃 선택 드롭다운 존재', async ({ page }) => {
    const layoutSelect = page.getByRole('combobox').first();
    await expect(layoutSelect).toBeVisible({ timeout: 5_000 });
  });

  test('레이아웃 선택 후 Realtime 연결 배지 출현', async ({ page }) => {
    const layoutSelect = page.getByRole('combobox').first();
    if (await layoutSelect.isVisible()) {
      await layoutSelect.click();
      const option = page.getByRole('option').first();
      if (await option.isVisible()) {
        await option.click();
        await expect(
          page.getByText(/구독중|연결|connected|realtime/i).first()
        ).toBeVisible({ timeout: 8_000 });
      }
    }
  });

  test('장비 상태 오버레이 배지 표시', async ({ page }) => {
    await expect(
      page.getByText(/Online|Offline|Error|온라인|오프라인/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
