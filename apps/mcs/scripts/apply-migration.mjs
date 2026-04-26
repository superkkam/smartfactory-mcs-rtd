// Supabase Service Role Key 로 마이그레이션 SQL 직접 실행
// 사용: node scripts/apply-migration.mjs <migration-file.sql>
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !roleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정');
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('사용: node scripts/apply-migration.mjs <path/to/migration.sql>');
  process.exit(1);
}

const sql = readFileSync(resolve(sqlFile), 'utf-8');
const supabase = createClient(url, roleKey);

const { error } = await supabase.rpc('exec_sql', { query: sql }).catch(() => ({ error: null }));

// Supabase는 raw SQL RPC를 직접 지원하지 않으므로 REST API 사용
const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
  method:  'POST',
  headers: {
    apikey:          roleKey,
    Authorization:   `Bearer ${roleKey}`,
    'Content-Type':  'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

if (!res.ok) {
  // exec_sql RPC 미존재 시 PostgreSQL REST API 직접 쿼리
  // Supabase의 pg_meta 엔드포인트 시도
  const pgRes = await fetch(`${url.replace('.supabase.co', '.supabase.co')}/rest/v1/`, {
    method: 'GET',
    headers: { apikey: roleKey, Authorization: `Bearer ${roleKey}` },
  });
  console.log('Supabase RPC 미지원 — Supabase SQL Editor에서 수동으로 아래 SQL을 실행하세요:');
  console.log('\n' + sql + '\n');
  process.exit(0);
}

console.log('마이그레이션 완료:', sqlFile);
