"""
Supabase → NetworkX DiGraph 로드
TypeScript graph-loader.ts와 동일한 로직 포팅

반환: (graph: nx.DiGraph, unit_labels: dict[uuid, label_str])
  - 노드 ID = DB uuid (mcs_equipment_unit.id)
  - 노드 속성: label (equipment_unit_id), unit_type, in_out_mode
  - 엣지 속성: weight
"""
import networkx as nx
from typing import Tuple, Dict
from services.supabase_client import get_supabase


def load_graph(layout_id: str) -> Tuple[nx.DiGraph, Dict[str, str]]:
    """
    특정 레이아웃의 전이 관계를 Supabase에서 로드하여 방향 가중 그래프 구성

    Args:
        layout_id: mcs_layout.id (uuid)

    Returns:
        (graph, unit_labels)
        - graph: NetworkX DiGraph (노드=unit_uuid, 엣지=departure→arrival+weight)
        - unit_labels: {unit_uuid: equipment_unit_id 라벨}

    Raises:
        ValueError: 레이아웃에 전이 관계가 없는 경우
    """
    client = get_supabase()

    # 1단계: 해당 레이아웃의 장비 ID 목록 조회
    resp = client.table("mcs_equipment").select("id").eq("layout_id", layout_id).execute()
    equipments = resp.data or []
    if not equipments:
        raise ValueError(f"레이아웃({layout_id})에 장비가 없습니다. 레이아웃을 먼저 저장해주세요.")

    equipment_ids = [e["id"] for e in equipments]

    # 2단계: 해당 장비들의 유닛 목록 조회
    units_resp = (
        client.table("mcs_equipment_unit")
        .select("id, equipment_unit_id, unit_type, in_out_mode")
        .in_("equipment_id", equipment_ids)
        .execute()
    )
    units = units_resp.data or []

    # 3단계: 전이 관계 로드
    rel_resp = (
        client.table("mcs_transfer_relation")
        .select("departure_unit_id, arrival_unit_id, weight")
        .eq("layout_id", layout_id)
        .execute()
    )
    relations = rel_resp.data or []

    if not relations:
        # 폴백: 레이아웃 JSON에서 직접 그래프 빌드 + DB 자동 복구
        print(f"[graph_loader] 전이 관계 없음 → 레이아웃 JSON 폴백 시도 (layout_id={layout_id})")
        relations = _build_relations_from_json(layout_id, client, units)
        if not relations:
            raise ValueError(
                f"레이아웃({layout_id})에 전이 관계가 없습니다. 레이아웃 모델러에서 저장 후 사용하세요."
            )

    # 유닛 정보 인덱싱
    unit_map: Dict[str, dict] = {u["id"]: u for u in units}
    unit_labels: Dict[str, str] = {u["id"]: u["equipment_unit_id"] for u in units}

    # 4단계: NetworkX 방향 가중 그래프 구성
    graph = nx.DiGraph()

    # 노드 추가 (전이 관계에 등장하는 유닛만)
    for rel in relations:
        for unit_id in [rel["departure_unit_id"], rel["arrival_unit_id"]]:
            if unit_id not in graph and unit_id in unit_map:
                u = unit_map[unit_id]
                graph.add_node(
                    unit_id,
                    label=u["equipment_unit_id"],
                    unit_type=u["unit_type"],
                    in_out_mode=u["in_out_mode"],
                )

    # 엣지 추가 (방향 가중)
    for rel in relations:
        dep = rel["departure_unit_id"]
        arr = rel["arrival_unit_id"]
        weight = float(rel["weight"])
        if dep in graph and arr in graph:
            graph.add_edge(dep, arr, weight=weight)

    return graph, unit_labels


def _build_relations_from_json(
    layout_id: str,
    client,
    units: list[dict],
) -> list[dict]:
    """
    레이아웃 JSON(json_data)에서 전이 관계를 재구성하여 반환하고, DB에도 자동 복구 삽입.

    syncLayoutToDb 가 실패했거나 오래된 저장본에 전이 관계가 없는 경우 폴백으로 사용.
    """
    # 레이아웃 JSON 조회
    layout_resp = (
        client.table("mcs_layout")
        .select("json_data")
        .eq("id", layout_id)
        .maybe_single()
        .execute()
    )
    if not layout_resp.data:
        return []

    json_data = layout_resp.data.get("json_data") or {}
    nodes = json_data.get("nodes", [])
    edges = json_data.get("edges", [])

    # 유닛 코드 → DB uuid 인덱스 (equipment_unit_id → id)
    units_by_code: dict[str, str] = {u["equipment_unit_id"]: u["id"] for u in units}

    # React Flow node.id → unit DB uuid 매핑 구성
    rf_to_unit_id: dict[str, str] = {}
    for node in nodes:
        node_id = node.get("id", "")
        node_type = node.get("type", "")
        data = node.get("data") or {}

        if node_type == "port":
            unit_code = (data.get("portId") or "").strip() or node_id
        elif node_type in ("node", "charge"):
            # charge 노드는 nodeId 필드 대신 nodeId 사용 (layout-modeler 규칙 동일)
            unit_code = (data.get("nodeId") or "").strip() or node_id
        else:
            # stocker/process/agv 는 port/node 유닛으로만 접근
            continue

        db_id = units_by_code.get(unit_code)
        if db_id:
            rf_to_unit_id[node_id] = db_id

    # transfer 엣지에서 전이 관계 구성
    relations = []
    for edge in edges:
        if edge.get("type") != "transfer":
            continue
        source = edge.get("source", "")
        target = edge.get("target", "")
        edge_data = edge.get("data") or {}
        weight = float(edge_data.get("weight") or 1.0)

        dep_id = rf_to_unit_id.get(source)
        arr_id = rf_to_unit_id.get(target)
        if not dep_id or not arr_id:
            continue

        relations.append({
            "layout_id":         layout_id,
            "departure_unit_id": dep_id,
            "arrival_unit_id":   arr_id,
            "weight":            weight,
        })

    if not relations:
        print(f"[graph_loader] JSON 폴백에서도 전이 관계를 찾을 수 없음 (엣지 수: {len(edges)})")
        return []

    # DB에 자동 복구 삽입 (이후 호출 시 폴백 없이 바로 로드 가능)
    try:
        client.table("mcs_transfer_relation").insert(relations).execute()
        print(f"[graph_loader] 전이 관계 {len(relations)}건 자동 복구 삽입 완료")
    except Exception as e:
        # 삽입 실패해도 이번 호출은 relations 메모리 데이터로 계속 진행
        print(f"[graph_loader] 자동 복구 삽입 실패 (무시): {e}")

    return [
        {"departure_unit_id": r["departure_unit_id"], "arrival_unit_id": r["arrival_unit_id"], "weight": r["weight"]}
        for r in relations
    ]
