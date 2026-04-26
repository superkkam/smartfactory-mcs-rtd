import { request } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';

export async function seedComplexLayout(): Promise<string> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post('/api/seed-complex-layout');

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`seed-complex-layout 실패: ${res.status()} ${body}`);
  }

  const data = await res.json();
  await ctx.dispose();
  // { layoutId: string } 반환
  return data.layoutId as string;
}
