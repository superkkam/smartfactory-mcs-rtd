import { useQuery } from '@tanstack/react-query';

export interface McsPortUnit {
  unitId:      string;
  label:       string;
  equipmentId: string;
  inOutMode:   string;
}

/** MCS API에서 현재 레이아웃 기준 Port 유닛 목록 조회 */
export function useMcsPorts() {
  return useQuery<McsPortUnit[]>({
    queryKey: ['mcs_ports'],
    queryFn: async () => {
      const res = await fetch('/api/mcs/ports');
      if (!res.ok) throw new Error('MCS 포트 목록 조회 실패');
      return res.json() as Promise<McsPortUnit[]>;
    },
    staleTime: 30_000,
  });
}
