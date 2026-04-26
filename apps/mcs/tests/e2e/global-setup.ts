import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { STORAGE_STATE } from '../../playwright.config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const E2E_EMAIL = 'e2e-test@mcs-e2e.local';
const E2E_PASSWORD = 'e2e-test-password-12345!';

setup('E2E 테스트 계정 생성 및 로그인 세션 저장', async ({ page }) => {
  // service_role 키로 Admin 클라이언트 생성 → 테스트 유저 자동 프로비저닝
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 이미 존재해도 무해 (에러 무시)
  await adminClient.auth.admin.createUser({
    email: E2E_EMAIL,
    password: E2E_PASSWORD,
    email_confirm: true,
  });

  // 로그인 페이지에서 이메일/비밀번호로 세션 획득
  await page.goto('/login');
  await page.getByLabel(/이메일/i).fill(E2E_EMAIL);
  await page.getByLabel(/비밀번호/i).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: /로그인/i }).click();

  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(page).toHaveURL(/dashboard/);

  await page.context().storageState({ path: STORAGE_STATE });
});
