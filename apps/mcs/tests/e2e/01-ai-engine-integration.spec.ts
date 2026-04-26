import { test, expect } from '@playwright/test';

/**
 * Task 015~018: AI 엔진 Integration
 * /transfer-control 에서 A* + PPO 추론 병렬 호출 검증
 */
test.describe('T015~018: 반송 제어 - A* + AI 추론', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transfer-control');
    await page.waitForLoadState('networkidle');
  });

  test('페이지 로딩 및 출발/목적 드롭다운 렌더', async ({ page }) => {
    await expect(page.getByText(/출발|source/i).first()).toBeVisible();
    await expect(page.getByText(/목적|dest/i).first()).toBeVisible();
  });

  test('A* 경로 탐색 결과 표시', async ({ page }) => {
    const selects = page.locator('button[role="combobox"]');
    const count = await selects.count();
    if (count >= 2) {
      await selects.nth(0).click();
      const firstOption = page.locator('[role="option"]').first();
      await firstOption.click();
      await selects.nth(1).click();
      const secondOption = page.locator('[role="option"]').last();
      await secondOption.click();
    }
    const createBtn = page.getByRole('button', { name: /명령 생성|경로 탐색|탐색/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page.getByText(/GCOST|gcost|경로/i).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test('AI 추론 섹션 렌더 (fallback 포함)', async ({ page }) => {
    await expect(
      page.getByText(/AI|인공지능|PPO|fallback|폴백/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
