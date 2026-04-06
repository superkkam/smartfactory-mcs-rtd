import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0, // 항상 stale — 마운트 시 즉시 refetch
        gcTime: 1000 * 60 * 5, // 5분
        retry: 1,
      },
    },
  });
}
