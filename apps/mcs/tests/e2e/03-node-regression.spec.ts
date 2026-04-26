import { test, expect } from '@playwright/test';

/**
 * Task 019: Waypoint → Node 용어 통일 회귀 검증
 */
test.describe('T019: Node 용어 통일 회귀', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/layout-modeler');
    await page.waitForLoadState('networkidle');
  });

  test('"Waypoint" 단어 미노출 확인', async ({ page }) => {
    const waypointText = page.getByText(/waypoint/i);
    await expect(waypointText).toHaveCount(0);
  });

  test('심볼 팔레트에 "Node" 항목 표시', async ({ page }) => {
    await expect(page.getByText(/^Node$|노드/i).first()).toBeVisible();
  });

  test('Node 항목이 팔레트에 존재', async ({ page }) => {
    const draggableNode = page.locator('[draggable="true"]').filter({ hasText: /node|노드/i });
    if (await draggableNode.count() > 0) {
      await expect(draggableNode.first()).toBeVisible();
    } else {
      await expect(page.getByText(/node|노드/i).first()).toBeVisible();
    }
  });

  test('시뮬레이션 드롭다운에 Waypoint 미노출', async ({ page }) => {
    await page.goto('/simulation');
    await page.waitForLoadState('networkidle');
    const waypointOption = page.getByRole('option', { name: /waypoint/i });
    await expect(waypointOption).toHaveCount(0);
  });
});
