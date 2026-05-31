"""
Claude Code 세션 트랜스크립트에서 실제 사용자 프롬프트를 추출하는 스크립트.

사용법:
    python docs/scripts/extract_prompts.py

출력:
    /tmp/prompts_all.json   — 전체 프롬프트 시간순
    /tmp/prompts_exp.json   — 실험 관련 하이라이트 프롬프트
"""
from __future__ import annotations

import json
import glob
import os
import re

# 트랜스크립트 디렉토리
TRANSCRIPT_DIR = os.path.expanduser(
    "~/.claude/projects/"
    "-Users-kkh-Desktop-2-kkh-2-Study-1-----1-26--1---2--------2------new"
)

# 실험 관련 키워드 (CAIE 논문 실험 파트 구현)
EXPERIMENT_KEYWORDS = [
    "실험", "experiment", "CAIE", "caie",
    "알고리즘", "algorithm",
    "CBS", "CACTUS", "cactus", "PPO", "ppo", "QMIX", "qmix",
    "지표", "metric", "makespan", "throughput",
    "figure", "Figure", "table", "Table",
    "seed", "시드", "시뮬",
    "통계", "Wilcoxon", "wilcoxon", "Kruskal",
    "sim", "SimPy", "simpy",
    "MLA", "mla_star", "CBS-TS", "cbs_ts",
    "avg_transfer", "path_optimality",
    "experiment_runner", "caie_experiment", "caie_figures", "caie_tables",
    "A*", "astar", "a_star",
    "30 seed", "25 seed", "시나리오",
    "가중 그래프", "88노드", "strategy",
]

# 제외 패턴 — 이 패턴으로 시작하면 실제 프롬프트가 아님
EXCLUDE_PATTERNS = [
    r"^\s*<",          # XML 태그 래퍼
    r"^\s*\[{",        # JSON 배열 페이로드
    r"^\s*{\"",        # JSON 오브젝트 페이로드
    r"^Tool loaded\.", # 훅 알림
    r"^Human: Tool loaded",
]

def is_real_prompt(text: str) -> bool:
    """실제 사용자 프롬프트인지 판별."""
    if not text or not text.strip():
        return False
    t = text.strip()
    for pat in EXCLUDE_PATTERNS:
        if re.match(pat, t):
            return False
    return True

def extract_text(content) -> str | None:
    """message content에서 텍스트 추출."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict):
                if part.get("type") == "text":
                    parts.append(part.get("text", ""))
                elif part.get("type") == "image":
                    parts.append("[이미지 첨부]")
        text = "\n".join(p for p in parts if p)
        return text if text else None
    return None

def is_experiment_related(text: str) -> bool:
    """실험 파트 관련 프롬프트인지 확인."""
    lower = text.lower()
    return any(kw.lower() in lower for kw in EXPERIMENT_KEYWORDS)

def main():
    files = sorted(
        glob.glob(os.path.join(TRANSCRIPT_DIR, "*.jsonl")),
        key=os.path.getmtime
    )
    print(f"세션 파일 수: {len(files)}개")

    all_prompts = []
    skipped = 0

    for fpath in files:
        fname = os.path.basename(fpath)
        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if obj.get("type") != "user":
                    continue

                content = obj.get("message", {}).get("content")
                text = extract_text(content)
                if not text:
                    continue

                if not is_real_prompt(text):
                    skipped += 1
                    continue

                all_prompts.append({
                    "timestamp": obj.get("timestamp", ""),
                    "session": fname,
                    "text": text.strip(),
                    "is_experiment": is_experiment_related(text),
                })

    # 시간순 정렬
    all_prompts.sort(key=lambda x: x["timestamp"])
    exp_prompts = [p for p in all_prompts if p["is_experiment"]]

    print(f"전체 프롬프트: {len(all_prompts)}개 (제외: {skipped}개)")
    print(f"실험 관련: {len(exp_prompts)}개")

    with open("/tmp/prompts_all.json", "w", encoding="utf-8") as f:
        json.dump(all_prompts, f, ensure_ascii=False, indent=2)

    with open("/tmp/prompts_exp.json", "w", encoding="utf-8") as f:
        json.dump(exp_prompts, f, ensure_ascii=False, indent=2)

    # 샘플 출력 (실험 관련 첫 5개)
    print("\n=== 실험 관련 프롬프트 샘플 (처음 5개) ===")
    for p in exp_prompts[:5]:
        print(f"[{p['timestamp'][:16]}] {p['text'][:100].replace(chr(10),' ')}")
        print("---")

if __name__ == "__main__":
    main()
