/**
 * MCS 스키마 카탈로그
 *
 * RTD 쿼리 빌더(query-builder-modal)와 룰 엔진(engine.ts)이 공용으로 참조하는
 * 실제 Supabase MCS 테이블·컬럼 메타 정보.
 *
 * DMS_LOT / DMS_EQUIPMENT 같은 더미 이름을 쓰지 않고 실제 mcs_* 테이블을 참조.
 * migration 004 컬럼까지 반영.
 */

/** 테이블별 조회 가능 컬럼 목록 */
export const MCS_TABLES: Record<string, string[]> = {
  mcs_carrier: [
    'carrier_id',
    'lot_id',
    'lot_state',
    'priority',
    'process_step',
    'due_time',
    'material_type',
    'carrier_type',
    'state',
    'current_equipment_id',
    'location_id',
    'created_at',
  ],
  mcs_equipment: [
    'equipment_id',
    'equipment_type',
    'state',
    'availability',
    'current_load',
    'capacity',
    'recipe_type',
    'ec_server_name',
    'inline_stocker',
    'location_id',
    'layout_id',
    'last_heartbeat_at',
  ],
  mcs_equipment_unit: [
    'equipment_unit_id',
    'equipment_id',
    'unit_type',
    'in_out_mode',
    'transfer_state',
    'current_carrier_id',
    'reserved_by_command_id',
    'queue_length',
    'last_state_changed_at',
  ],
  mcs_transfer_relation: [
    'departure_unit_id',
    'arrival_unit_id',
    'transport_equipment_id',
    'weight',
    'layout_id',
  ],
  mcs_macro_command: [
    'command_id',
    'carrier_id',
    'source_unit_id',
    'dest_unit_id',
    'state',
    'priority',
    'created_at',
  ],
};

/** 비개발자를 위한 컬럼 한국어 설명 */
export const MCS_COLUMN_LABELS: Record<string, Record<string, string>> = {
  mcs_carrier: {
    carrier_id:           '캐리어 ID',
    lot_id:               'Lot ID',
    lot_state:            'Lot 상태 (WAIT/PROCESSING/DONE/HOLD)',
    priority:             '우선순위 (1=최고)',
    process_step:         '공정 단계',
    due_time:             '납기 기한',
    material_type:        '자재 유형',
    carrier_type:         '캐리어 유형',
    state:                '캐리어 상태 (Stored/Transferring/Installed)',
    current_equipment_id: '현재 설비 ID (UUID)',
    location_id:          '정밀 위치 유닛 ID (UUID)',
    created_at:           '생성 시각',
  },
  mcs_equipment: {
    equipment_id:     '설비 ID',
    equipment_type:   '설비 유형 (Stocker/Process/AGV 등)',
    state:            '설비 상태 (Online/Offline/Error)',
    availability:     '가용 여부 (true/false)',
    current_load:     '현재 점유 Lot 수',
    capacity:         '수용 가능 최대 Lot 수',
    recipe_type:      '처리 가능 레시피/자재 유형',
    ec_server_name:   '제어 서버 이름',
    inline_stocker:   '인라인 스토커 여부',
    location_id:      '이동형 장비 현재 위치 유닛 (UUID)',
    layout_id:        '레이아웃 ID (UUID)',
    last_heartbeat_at:'마지막 상태 갱신 시각',
  },
  mcs_equipment_unit: {
    equipment_unit_id:      '유닛 ID',
    equipment_id:           '상위 설비 ID (UUID)',
    unit_type:              '유닛 유형 (Port/Crane/AGV/Node)',
    in_out_mode:            '입출 모드 (In/Out/Both)',
    transfer_state:         '반송 상태 (Idle/Transferring 등)',
    current_carrier_id:     '현재 점유 캐리어 ID (UUID, null=비어있음)',
    reserved_by_command_id: '예약 명령 ID (UUID, null=미예약)',
    queue_length:           '대기열 길이',
    last_state_changed_at:  '마지막 상태 변경 시각',
  },
  mcs_transfer_relation: {
    departure_unit_id:     '출발 유닛 ID (UUID)',
    arrival_unit_id:       '도착 유닛 ID (UUID)',
    transport_equipment_id:'반송 담당 설비 ID (UUID)',
    weight:                '경로 가중치 (비용)',
    layout_id:             '레이아웃 ID (UUID)',
  },
  mcs_macro_command: {
    command_id:      '명령 ID',
    carrier_id:      '캐리어 ID (UUID)',
    source_unit_id:  '출발 유닛 ID (UUID)',
    dest_unit_id:    '목적지 유닛 ID (UUID)',
    state:           '명령 상태 (Pending/InProgress/Completed/Failed)',
    priority:        '명령 우선순위',
    created_at:      '생성 시각',
  },
};

/** 테이블 이름 목록 */
export const MCS_TABLE_NAMES = Object.keys(MCS_TABLES);

/** 파라미터 바인딩 예약어 (MES 이벤트 파라미터) */
export const MES_EVENT_PARAMS = [
  ':equipmentId',  // 이벤트 발생 설비 ID
  ':eventType',    // 이벤트 유형 (LOAD_REQUEST 등)
  ':lotId',        // 요청 Lot ID (TRANSFER_REQUEST 시)
  ':carrierId',    // 요청 캐리어 ID
  ':layoutId',     // 현재 활성 레이아웃 ID
] as const;
