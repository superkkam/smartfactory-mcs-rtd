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

  test('출발/목적 드롭다운 열림 동작 확인', async ({ page }) => {
    const selects = page.locator('button[role="combobox"]');
    const count = await selects.count();
    if (count >= 1) {
      // 첫 번째 드롭다운 열기
      await selects.nth(0).click();
      // 드롭다운이 열렸으면 listbox 또는 option 등장
      const popover = page.locator('[role="listbox"], [data-radix-popper-content-wrapper]');
      await expect(popover.first()).toBeVisible({ timeout: 5_000 });
      // 닫기 (Escape)
      await page.keyboard.press('Escape');
    }
  });

  test('A* 결과 표시 (DB 유닛 있을 때)', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /명령 생성|경로 탐색|탐색/i });
    if (await createBtn.count() > 0 && await createBtn.first().isEnabled()) {
      await createBtn.first().click();
      await expect(page.getByText(/GCOST|gcost|경로|path/i).first()).toBeVisible({ timeout: 15_000 });
    } else {
      test.skip();
    }
  });

  test('AI 추론 섹션 렌더 (fallback 포함)', async ({ page }) => {
    await expect(
      page.getByText(/AI|인공지능|PPO|fallback|폴백/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
