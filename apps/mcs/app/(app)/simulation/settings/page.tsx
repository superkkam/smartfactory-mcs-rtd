'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CarrierCrudTable }   from '@/components/simulation/carrier-crud-table';
import { DefaultParamsForm }  from '@/components/simulation/default-params-form';

export default function SimulationSettingsPage() {
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">시뮬레이션 설정</h1>
        <p className="mt-0.5 text-sm text-gray-500">캐리어 관리 및 기본 파라미터 설정</p>
      </div>

      {/* 캐리어 CRUD 테이블 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-800">캐리어 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <CarrierCrudTable />
        </CardContent>
      </Card>

      {/* 기본 파라미터 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-800">기본 파라미터</CardTitle>
        </CardHeader>
        <CardContent>
          <DefaultParamsForm />
        </CardContent>
      </Card>
    </div>
  );
}
