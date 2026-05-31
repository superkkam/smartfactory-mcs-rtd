"""
레이아웃 Fixture 내보내기 — Supabase → JSON

CAIE 실험용 재현 가능한 그래프 fixture 생성.
PPO 모델이 학습된 레이아웃과 동일한 노드 순서를 보존한다.

사용법:
    cd apps/ai-engine
    python scripts/export_layout.py --layout-id <UUID> --out scripts/fixtures/fab_layout.json

    # Supabase 없이 합성 레이아웃 생성 (PPO는 A* 폴백 동작)
    python scripts/export_layout.py --synthetic --out scripts/fixtures/fab_layout.json
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── 합성 팹 레이아웃 생성 ──────────────────────────────────────────
def build_synthetic_fab_graph():
    """
    3-Bay 반도체 팹 AMHS 합성 레이아웃 (단방향 루프 위상).

    위상:
      상단 주통로 (UL → UR, 단방향) ─ 15 conveyor 노드
      하단 주통로 (LR → LL, 단방향) ─ 15 conveyor 노드
      우측 턴오버 (UR → LR)          ─ 2 conveyor 노드
      좌측 턴오버 (LL → UL)          ─ 2 conveyor 노드
      Bay 진입/진출 분기 노드         ─ 12 × 2 = 24 nodr
      공정 포트 노드 (Port 타입)      ─ 12 Port
      스토커 포트 노드 (Port 타입)    ─ 2 Port
      합계: 15+15+2+2+24+12+2 = 72 nodes

    엣지 가중치:
      주통로 간격 : 3.0 m
      Bay 분기    : 1.5 m
      포트 연결   : 1.0 m
      턴오버      : 2.0 m

    CARRIER_SPEED = 0.3 m/s 기준 → 이동 시간 = weight / 0.3
    """
    nodes = []
    edges = []

    def add_node(nid, unit_type, label=None):
        nodes.append({"id": nid, "unit_type": unit_type, "label": label or nid})

    def add_edge(src, tgt, weight):
        edges.append({"source": src, "target": tgt, "weight": weight})

    # ── 상단 주통로 U00~U14 ────────────────────────────────────────
    upper = [f"U{i:02d}" for i in range(15)]
    for n in upper:
        add_node(n, "Conveyor")
    for i in range(14):
        add_edge(upper[i], upper[i + 1], 3.0)

    # ── 하단 주통로 L00~L14 (우→좌) ──────────────────────────────
    lower = [f"L{i:02d}" for i in range(15)]
    for n in lower:
        add_node(n, "Conveyor")
    for i in range(14, 0, -1):
        add_edge(lower[i], lower[i - 1], 3.0)

    # ── 우측 턴오버 ────────────────────────────────────────────────
    add_node("RT1", "Conveyor")
    add_node("RT2", "Conveyor")
    add_edge("U14", "RT1", 2.0)
    add_edge("RT1",  "RT2", 2.0)
    add_edge("RT2", "L14", 2.0)

    # ── 좌측 턴오버 ────────────────────────────────────────────────
    add_node("LT1", "Conveyor")
    add_node("LT2", "Conveyor")
    add_edge("L00", "LT1", 2.0)
    add_edge("LT1", "LT2", 2.0)
    add_edge("LT2", "U00", 2.0)

    # ── Bay 1 (U02~U05, L02~L05) — 공정 설비 P01~P04 ─────────────
    # Bay 2 (U06~U09, L06~L09) — 공정 설비 P05~P08
    # Bay 3 (U10~U13, L10~L13) — 공정 설비 P09~P12
    # Stocker (U01, L01) — S01, S02
    bay_config = [
        # (upper_idx, port_id, label)
        (1,  "S01", "STOCKER-1"),
        (2,  "P01", "PROC-A1-IN"),
        (3,  "P02", "PROC-A2-IN"),
        (4,  "P03", "PROC-A3-IN"),
        (5,  "P04", "PROC-A4-IN"),
        (6,  "P05", "PROC-B1-IN"),
        (7,  "P06", "PROC-B2-IN"),
        (8,  "P07", "PROC-B3-IN"),
        (9,  "P08", "PROC-B4-IN"),
        (10, "P09", "PROC-C1-IN"),
        (11, "P10", "PROC-C2-IN"),
        (12, "P11", "PROC-C3-IN"),
        (13, "P12", "PROC-C4-IN"),
        (13, "S02", "STOCKER-2"),  # 하단에 연결
    ]

    for upper_idx, port_id, label in bay_config:
        u_node = upper[upper_idx]
        l_node = lower[upper_idx]

        in_spur  = f"IN_{port_id}"
        out_spur = f"OUT_{port_id}"
        unit_type = "Port" if port_id.startswith("P") or port_id.startswith("S") else "Conveyor"

        add_node(in_spur,  "Conveyor")
        add_node(port_id,  unit_type, label)
        add_node(out_spur, "Conveyor")

        # 상단 통로 → 진입 spur → Port
        add_edge(u_node,   in_spur,  1.5)
        add_edge(in_spur,  port_id,  1.0)

        # Port → 진출 spur → 하단 통로
        add_edge(port_id,  out_spur, 1.0)
        add_edge(out_spur, l_node,   1.5)

    # 노드 순서 고정 (재현성을 위해 id 정렬)
    node_order = [n["id"] for n in nodes]

    return {
        "layout_id": "synthetic_fab_3bay",
        "layout_name": "Synthetic 3-Bay Semiconductor Fab AMHS",
        "node_count": len(nodes),
        "port_count": sum(1 for n in nodes if n["unit_type"] == "Port"),
        "edge_count": len(edges),
        "node_order": node_order,
        "nodes": nodes,
        "edges": edges,
    }


# ── Supabase 레이아웃 내보내기 ────────────────────────────────────
def export_from_supabase(layout_id: str):
    """Supabase에서 레이아웃 로드 후 fixture dict 반환"""
    from services.graph_loader import load_graph

    graph, unit_labels = load_graph(layout_id)

    nodes = []
    for nid, data in graph.nodes(data=True):
        nodes.append({
            "id":        nid,
            "unit_type": data.get("unit_type", "Conveyor"),
            "label":     unit_labels.get(nid, nid),
        })

    edges = []
    for u, v, data in graph.edges(data=True):
        edges.append({
            "source": u,
            "target": v,
            "weight": data.get("weight", 1.0),
        })

    node_order = [n["id"] for n in nodes]

    return {
        "layout_id":    layout_id,
        "layout_name":  f"MCS Fab Layout ({layout_id[:8]}...)",
        "node_count":   len(nodes),
        "port_count":   sum(1 for n in nodes if n["unit_type"] == "Port"),
        "edge_count":   len(edges),
        "node_order":   node_order,
        "nodes":        nodes,
        "edges":        edges,
    }


# ── fixture → NetworkX DiGraph ────────────────────────────────────
def load_fixture(fixture_path: str):
    """
    저장된 fixture JSON → (graph, unit_labels).
    node_order 필드가 있으면 해당 순서로 노드를 추가해 PPO 인덱스 일관성 보장.
    """
    import networkx as nx

    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    node_map = {n["id"]: n for n in data["nodes"]}
    node_order = data.get("node_order", list(node_map.keys()))

    graph = nx.DiGraph()
    unit_labels = {}

    for nid in node_order:
        n = node_map.get(nid)
        if n:
            graph.add_node(nid, unit_type=n["unit_type"], label=n["label"])
            unit_labels[nid] = n["label"]

    for e in data["edges"]:
        graph.add_edge(e["source"], e["target"], weight=float(e["weight"]))

    port_count = sum(1 for _, d in graph.nodes(data=True) if d.get("unit_type") == "Port")
    print(
        f"[fixture] '{data.get('layout_name')}' 로드 완료 "
        f"— 노드 {graph.number_of_nodes()}개, 포트 {port_count}개, "
        f"엣지 {graph.number_of_edges()}개"
    )
    return graph, unit_labels


# ── CLI ───────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="레이아웃 fixture 내보내기")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--layout-id", help="Supabase mcs_layout UUID")
    group.add_argument("--synthetic", action="store_true", help="합성 3-Bay 팹 레이아웃 생성")
    parser.add_argument("--out", default="scripts/fixtures/fab_layout.json", help="출력 파일 경로")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.out), exist_ok=True)

    if args.synthetic:
        data = build_synthetic_fab_graph()
        print(f"합성 레이아웃 생성 — 노드 {data['node_count']}개, 포트 {data['port_count']}개")
    else:
        print(f"Supabase에서 레이아웃 로드 중: {args.layout_id}")
        data = export_from_supabase(args.layout_id)
        print(f"로드 완료 — 노드 {data['node_count']}개, 포트 {data['port_count']}개")

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"fixture 저장 완료: {args.out}")


if __name__ == "__main__":
    main()
