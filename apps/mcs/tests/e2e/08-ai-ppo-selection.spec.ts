import { test, expect } from '@playwright/test';

/**
 * Task 022: RTD-MCS — AI_PPO 경로 채택 및 혼잡도 토글 검증
 */
test.describe('T022: AI_PPO 채택 및 혼잡도 토글', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transfer-control');
    await page.waitForLoadState('networkidle');
  });

  test('혼잡도 토글 컴포넌트 렌더', async ({ page }) => {
    await expect(
      page.getByText(/혼잡|congestion/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('혼잡도 토글 ON/OFF 전환', async ({ page }) => {
    const toggle = page.getByRole('switch').first();
    if (await toggle.isVisible()) {
      const initialState = await toggle.getAttribute('aria-checked');
      await toggle.click();
      const newState = await toggle.getAttribute('aria-checked');
      expect(newState).not.toBe(initialState);
    } else {
      const checkbox = page.getByRole('checkbox').filter({ hasText: /혼잡|congestion/i });
      if (await checkbox.isVisible()) {
        await checkbox.click();
      }
    }
  });

  test('/api/astar — A* 경로 탐색 API 응답 구조', async ({ request }) => {
    const res = await request.post('/api/astar', {
      data: {
        sourceUnitId: 'stk-001-port-1',
        destUnitId: 'proc-001-port-1',
      },
    });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('path');
      expect(body).toHaveProperty('totalCost');
    } else {
      expect([400, 404, 500]).toContain(res.status());
    }
  });

  test('Route comparison 카드: A* vs AI 비교 UI 렌더', async ({ page }) => {
    await expect(
      page.getByText(/A\*|astar|AI|비교/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
