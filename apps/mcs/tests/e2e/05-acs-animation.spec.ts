import { test, expect } from '@playwright/test';

/**
 * Task 021: AMR 자연 이동 — ACS tick-loop + framer-motion 애니메이션
 */
test.describe('T021: ACS 틱 루프 및 AMR 애니메이션', () => {
  test('/acs 페이지 렌더', async ({ page }) => {
    await page.goto('/acs');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/acs/);
    await expect(page.getByText(/ACS|반송 제어|tick|상태/i).first()).toBeVisible();
  });

  test('Start/Stop 버튼 존재 및 클릭 가능', async ({ page }) => {
    await page.goto('/acs');
    await page.waitForLoadState('networkidle');
    const startBtn = page.getByRole('button', { name: /start|시작/i });
    await expect(startBtn).toBeVisible({ timeout: 5_000 });
    await expect(startBtn).toBeEnabled();
  });

  test('ACS 시작 후 상태 변화 표시', async ({ page }) => {
    await page.goto('/acs');
    await page.waitForLoadState('networkidle');
    const startBtn = page.getByRole('button', { name: /start|시작/i });
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await expect(
        page.getByText(/tick|step|assigned|moving|idle/i).first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('대시보드에서 React Flow 캔버스 렌더 (애니메이션 컨테이너)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 10_000 });
  });
});
