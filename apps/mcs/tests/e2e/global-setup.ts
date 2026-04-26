import { test as setup, expect } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';

const E2E_EMAIL = process.env.E2E_EMAIL ?? '';
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? '';

setup('로그인 세션 저장', async ({ page }) => {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      'E2E_EMAIL, E2E_PASSWORD 환경변수를 .env.local에 설정해 주세요.\n예: E2E_EMAIL=test@example.com\nE2E_PASSWORD=yourpassword'
    );
  }

  await page.goto('/login');
  await page.getByLabel(/이메일/i).fill(E2E_EMAIL);
  await page.getByLabel(/비밀번호/i).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: /로그인/i }).click();

  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(page).toHaveURL(/dashboard/);

  await page.context().storageState({ path: STORAGE_STATE });
});
