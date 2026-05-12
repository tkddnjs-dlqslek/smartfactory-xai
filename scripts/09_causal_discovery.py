"""
Causal Discovery — 24센서 간 인과 그래프 학습
방법: 데이터 기반 상관관계 + 사출성형 사이클 도메인 지식 (Time-Ordering Constraint)
출력: results/causal_graph.json
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd

from src.config import MODEL_DIR, RESULT_DIR, SENSOR_COLS

# ── 데이터 로드 ──
X_train = np.load(os.path.join(MODEL_DIR, 'X_train.npy'))
print(f"[로드] X_train: {X_train.shape}")

# ── 1. Pearson 상관계수 행렬 ──
df_train = pd.DataFrame(X_train, columns=SENSOR_COLS)
corr = df_train.corr().abs()
print(f"[상관계수] |r| 평균: {corr.values[np.triu_indices_from(corr, 1)].mean():.3f}")

# ── 2. 사출성형 사이클 단계 (Time Ordering Constraint) ──
# 단계가 작을수록 먼저 일어남 → 더 작은 단계 → 더 큰 단계로만 인과 가능
CYCLE_STAGE = {
    'Hopper_Temperature':       1,  # 원재료 투입
    'Barrel_Temperature_6':     2,  # 후미 가열
    'Barrel_Temperature_5':     2,
    'Barrel_Temperature_4':     2,
    'Barrel_Temperature_3':     2,
    'Barrel_Temperature_2':     2,
    'Barrel_Temperature_1':     2,
    'Max_Screw_RPM':            3,  # 스크류 회전
    'Average_Screw_RPM':        3,
    'Max_Back_Pressure':        4,  # 배압
    'Average_Back_Pressure':    4,
    'Plasticizing_Time':        5,  # 가소화
    'Plasticizing_Position':    5,
    'Max_Injection_Speed':      6,  # 사출 속도
    'Max_Injection_Pressure':   7,  # 사출 압력
    'Injection_Time':           8,  # 사출 시간
    'Filling_Time':             9,  # 충전
    'Max_Switch_Over_Pressure': 10, # 절환
    'Cushion_Position':         11, # 쿠션
    'Mold_Temperature_3':       12, # 금형 (사이클 내내 영향)
    'Mold_Temperature_4':       12,
    'Cycle_Time':               13, # 전체 사이클
    'Clamp_Close_Time':         14, # 형체
    'Clamp_Open_Position':      14,
}

# ── 3. 인과 엣지 구성 ──
# 규칙: |r| > THRESH AND stage(A) < stage(B) → A → B (인과)
THRESH = 0.40  # 상관계수 임계값
edges = []  # (source, target, weight)
for i, ci in enumerate(SENSOR_COLS):
    for j, cj in enumerate(SENSOR_COLS):
        if i == j: continue
        if ci not in CYCLE_STAGE or cj not in CYCLE_STAGE: continue
        if CYCLE_STAGE[ci] >= CYCLE_STAGE[cj]: continue  # 시간 순서 위반
        r = float(corr.iloc[i, j])
        if r >= THRESH:
            edges.append({'source': ci, 'target': cj, 'weight': round(r, 3)})

# 같은 stage 내에서는 양방향 표시는 안 하고 인과 엣지에서 제외
print(f"[인과 엣지] {len(edges)}개 (|r| ≥ {THRESH}, 시간 순서 만족)")

# ── 4. 노드 정보 ──
nodes = []
for col in SENSOR_COLS:
    nodes.append({
        'id': col,
        'label': col.replace('_', ' '),
        'stage': CYCLE_STAGE.get(col, 99),
        'category': (
            '시간' if 'Time' in col else
            '위치' if 'Position' in col else
            'RPM' if 'RPM' in col else
            '압력' if 'Pressure' in col else
            '온도' if 'Temperature' in col else
            '기타'
        ),
    })

# ── 5. 저장 ──
graph_data = {
    'nodes': nodes,
    'edges': edges,
    'meta': {
        'method': 'Time-Ordered Correlation (사출성형 사이클 제약)',
        'threshold': THRESH,
        'n_nodes': len(nodes),
        'n_edges': len(edges),
        'data_n': len(X_train),
        'note': 'Pearson |r| ≥ 0.40 + Cycle Stage 시간 순서 만족 시 인과 추정. PC/GES 알고리즘은 본선 구현 예정.',
    },
}
out_path = os.path.join(RESULT_DIR, 'causal_graph.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(graph_data, f, ensure_ascii=False, indent=2)

print(f"[저장] {out_path}")
print(f"\n[인과 강한 엣지 Top-10]")
for e in sorted(edges, key=lambda x: -x['weight'])[:10]:
    print(f"  {e['source']} → {e['target']}  (|r| = {e['weight']})")
