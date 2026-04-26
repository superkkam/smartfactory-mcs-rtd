import { test, expect } from '@playwright/test';

/**
 * Task 022: RTD-MCS 통합 — 비활성 모드 (NEXT_PUBLIC_RTD_ENABLED=false)
 */
test.describe('T022: RTD 비활성 모드', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transfer-control');
    await page.waitForLoadState('networkidle');
  });

  test('RtdStatusBadge — 비활성/비연결 상태 표시', async ({ page }) => {
    await expect(
      page.getByText(/비활성|비연결|RTD.*OFF|disabled|disconnected/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('RTD 수동 트리거 버튼 비활성 또는 미노출', async ({ page }) => {
    const triggerBtn = page.getByRole('button', { name: /RTD.*트리거|트리거.*RTD|trigger/i });
    if (await triggerBtn.isVisible()) {
      await expect(triggerBtn).toBeDisabled();
    } else {
      await expect(triggerBtn).toHaveCount(0);
    }
  });

  test('수동 반송 명령 생성 버튼은 활성 상태', async ({ page }) => {
    const manualBtn = page.getByRole('button', { name: /명령 생성|경로 탐색|탐색/i });
    if (await manualBtn.isVisible()) {
      await expect(manualBtn).toBeEnabled();
    }
  });
});
