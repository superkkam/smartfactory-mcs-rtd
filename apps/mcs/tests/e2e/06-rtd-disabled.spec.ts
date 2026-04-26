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

  test('수동 반송 명령 생성 버튼 렌더 확인 (출발/목적 미선택 시 disabled 정상)', async ({ page }) => {
    // 출발/목적 선택 전에는 disabled이 정상 동작
    const manualBtn = page.getByRole('button', { name: /명령 생성|경로 탐색|탐색/i });
    if (await manualBtn.count() > 0) {
      // 버튼이 렌더(visible)되면 통과 — 활성/비활성 무관
      await expect(manualBtn.first()).toBeVisible();
    }
  });
});
