"use client";
/* SmartFactory XAI — 안전 관리 (Safety) · 통합 플랫폼 안전 축
   센서 이상(z-score)을 안전 위험(과열·과압·기계)으로 매핑 → /predict 라이브 연동.
   고온/고압은 곧 작업자 안전 위험 → 이상탐지 엔진을 안전 모니터링에 재활용(정직한 파생). */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api, scenarioStore, PredictResult, Scenario } from "@/lib/api";

// 안전 관련 센서 그룹 → 위험 유형
const HAZARD = {
  "온도 / TEMP": { type: "과열", icon: "🔥", action: "냉각수 유량·가열대 출력 점검 · 화상 위험 구역 접근 제한", col: "#FFA756" },
  "압력 / PRESS": { type: "과압", icon: "⚠", action: "유압 라인·안전밸브 점검 · 고압 분출 위험 · 보호구 착용", col: "var(--sx-red-soft)" },
  "속도 / RPM": { type: "기계", icon: "⚙", action: "스크류 구동부 점검 · 회전체 끼임 위험 · 비상정지 확인", col: "var(--sx-cyan)" },
};
const lvl = (z: number) => (Math.abs(z) >= 4 ? { t: "위험", c: "var(--sx-red-soft)", n: 3 } : Math.abs(z) >= 2 ? { t: "경고", c: "#FFA756", n: 2 } : { t: "정상", c: "var(--sx-cyan)", n: 1 });

export default function SafetyPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [sel, setSel] = useState(0);
  const [r, setR] = useState<PredictResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { scenarios } = await api.scenarios();
        setScenarios(scenarios);
        const stored = scenarioStore.get();
        const def = stored !== null && stored < scenarios.length ? stored : scenarios.length - 1;
        setSel(def);
        setR(await api.predict(scenarios[def].z));
      } catch (e: any) { setErr(e.message || "백엔드 연결 실패"); }
    })();
  }, []);

  async function pick(i: number) {
    setSel(i); setErr(null); scenarioStore.set(i);
    try { setR(await api.predict(scenarios[i].z)); } catch (e: any) { setErr(e.message || "예측 실패"); }
  }

  // 안전 관련 그룹에서 경보 추출
  const groups = r?.sensor_groups ?? [];
  const safetyGroups = groups.filter((g) => HAZARD[g.group as keyof typeof HAZARD]);
  const alerts: any[] = [];
  safetyGroups.forEach((g) => {
    const h = HAZARD[g.group as keyof typeof HAZARD];
    g.rows.forEach((row) => {
      if (Math.abs(row.sigma) >= 2) alerts.push({ ...row, hazard: h, lv: lvl(row.sigma) });
    });
  });
  alerts.sort((a, b) => Math.abs(b.sigma) - Math.abs(a.sigma));

  const maxByType = (gname: string) => {
    const g = groups.find((x) => x.group === gname);
    if (!g) return 0;
    return Math.max(0, ...g.rows.map((x) => x.sigma));
  };
  const overheat = maxByType("온도 / TEMP");
  const overpress = maxByType("압력 / PRESS");
  const mech = Math.max(0, ...(groups.find((g) => g.group === "속도 / RPM")?.rows.map((x) => Math.abs(x.sigma)) ?? [0]));
  const overallN = Math.max(lvl(overheat).n, lvl(overpress).n, lvl(mech).n);
  const overall = overallN === 3 ? { t: "위험", c: "var(--sx-red-soft)" } : overallN === 2 ? { t: "경고", c: "#FFA756" } : { t: "안전", c: "var(--sx-cyan)" };

  return (
    <DashShell activeTab={5} scenario={sel === 0 ? "정상" : scenarios[sel]?.name || "위험"}
      headline="안전 위험 모니터링 · 실시간"
      sub={`센서 이상 → 작업자 안전 위험 자동 변환 · ISO 12100 위험성 평가${err ? " · ⚠ 백엔드 미연결" : ""}`}>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="eyebrow" style={{ marginRight: 4 }}>운전 상태</span>
        {scenarios.map((s, i) => {
          const on = i === sel;
          const danger = s.name.startsWith("위험") || s.name.startsWith("긴급");
          return (
            <button key={s.name} onClick={() => pick(i)} className="btn subtle"
              style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700,
                border: "1px solid " + (on ? (danger ? "var(--sx-red-bd)" : "var(--sx-cyan-bd)") : "var(--sx-border-2)"),
                background: on ? (danger ? "var(--sx-red-bg)" : "var(--sx-cyan-bg)") : "transparent",
                color: on ? (danger ? "var(--sx-red-soft)" : "var(--sx-cyan)") : "var(--sx-text-2)" }}>{s.name}</button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        <div className={"kpi" + (overall.t === "위험" ? " red" : overall.t === "경고" ? "" : " cyan")}>
          <div className="lbl">종합 안전 등급</div>
          <div className="val" style={{ color: overall.c }}>{overall.t}</div>
          <div className="ci">{alerts.length}건 활성 경보</div>
        </div>
        <div className={"kpi" + (lvl(overheat).n >= 2 ? " red" : "")}>
          <div className="lbl">과열 위험 🔥</div>
          <div className="val num">{overheat.toFixed(1)}<span className="u">σ</span></div>
          <div className="ci" style={{ color: lvl(overheat).c }}>{lvl(overheat).t} · 온도계열 최대</div>
        </div>
        <div className={"kpi" + (lvl(overpress).n >= 2 ? " red" : "")}>
          <div className="lbl">과압 위험 ⚠</div>
          <div className="val num">{overpress.toFixed(1)}<span className="u">σ</span></div>
          <div className="ci" style={{ color: lvl(overpress).c }}>{lvl(overpress).t} · 압력계열 최대</div>
        </div>
        <div className="kpi">
          <div className="lbl">기계 위험 ⚙</div>
          <div className="val num">{mech.toFixed(1)}<span className="u">σ</span></div>
          <div className="ci" style={{ color: lvl(mech).c }}>{lvl(mech).t} · 회전체</div>
        </div>
        <div className="kpi cyan">
          <div className="lbl">무사고 연속</div>
          <div className="val num">147<span className="u">일</span></div>
          <div className="ci">목표 365일 · 가정</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12, flex: 1, minHeight: 0 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="h"><span className="ttl">⚠ 안전 경보 · 실시간</span><span className="sub">|σ| ≥ 2 안전관련 센서 · {alerts.length}건</span></div>
          <div className="b" style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, overflow: "auto" }}>
            {alerts.map((a, i) => (
              <div key={a.name + i} style={{ padding: "10px 12px", background: "var(--sx-surface-2)", borderLeft: `3px solid ${a.lv.c}`, border: "1px solid var(--sx-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13 }}>{a.hazard.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{a.hazard.type} · {a.name}</span>
                  <span className="num" style={{ fontSize: 10, color: a.lv.c, fontWeight: 700 }}>{a.sigma > 0 ? "+" : ""}{a.sigma.toFixed(1)}σ</span>
                  <span className="tag" style={{ marginLeft: "auto", color: a.lv.c }}>{a.lv.t}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--sx-text-2)", fontWeight: 500, marginTop: 6, lineHeight: 1.45 }}>{a.hazard.action}</div>
              </div>
            ))}
            {!alerts.length && <div style={{ fontSize: 11, color: "var(--sx-text-3)", padding: 8 }}>{r ? "✓ 안전 관련 센서 모두 정상 범위" : "분석 대기 중…"}</div>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <div className="card" style={{ flex: 1 }}>
            <div className="h"><span className="ttl">위험성 평가 매트릭스</span><span className="sub">발생가능성 × 심각도 · ISO 12100</span></div>
            <div className="b">
              <svg viewBox="0 0 300 200" style={{ width: "100%", height: 200, display: "block" }}>
                {/* 3x3 위험 매트릭스 */}
                {[0, 1, 2].map((row) => [0, 1, 2].map((col) => {
                  const score = (col + 1) * (3 - row);
                  const c = score >= 6 ? "var(--sx-red-bg)" : score >= 3 ? "rgba(255,167,86,0.12)" : "var(--sx-cyan-bg)";
                  const bd = score >= 6 ? "var(--sx-red-bd)" : score >= 3 ? "rgba(255,167,86,0.3)" : "var(--sx-cyan-bd)";
                  return <rect key={`${row}-${col}`} x={60 + col * 70} y={20 + row * 50} width="68" height="48" fill={c} stroke={bd} strokeWidth="0.8" />;
                }))}
                {/* 위험 플롯 (과열/과압/기계) */}
                {[
                  { lbl: "과열", z: overheat, x: 60 + (Math.min(2, Math.floor(Math.abs(overheat) / 2)) ) * 70 + 34 },
                  { lbl: "과압", z: overpress, x: 60 + (Math.min(2, Math.floor(Math.abs(overpress) / 2))) * 70 + 34 },
                ].map((p, i) => {
                  const sevRow = 2 - Math.min(2, Math.floor(Math.abs(p.z) / 2));
                  return Math.abs(p.z) >= 2 ? (
                    <g key={i}>
                      <circle cx={p.x} cy={20 + sevRow * 50 + 24} r="9" fill="var(--sx-red)" opacity="0.9" />
                      <text x={p.x} y={20 + sevRow * 50 + 27} fill="#fff" fontSize="8" fontWeight="800" textAnchor="middle">{p.lbl}</text>
                    </g>
                  ) : null;
                })}
                <text x="155" y="14" fill="var(--sx-text-3)" fontSize="8" fontWeight="700" textAnchor="middle">심각도 →</text>
                <text x="50" y="120" fill="var(--sx-text-3)" fontSize="8" fontWeight="700" textAnchor="middle" transform="rotate(-90 50 120)">발생가능성 →</text>
              </svg>
            </div>
          </div>
          <div className="card">
            <div className="h"><span className="ttl">안전 조치 체크리스트</span><span className="sub">자동 생성</span></div>
            <div className="b" style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11 }}>
              {[
                { t: "비상정지(E-STOP) 동작 확인", on: overallN >= 2 },
                { t: "고온/고압 구역 접근 제한", on: lvl(overheat).n >= 2 || lvl(overpress).n >= 2 },
                { t: "보호구(내열장갑·보안경) 착용", on: lvl(overheat).n >= 2 },
                { t: "안전밸브 작동 점검", on: lvl(overpress).n >= 2 },
              ].map((c) => (
                <div key={c.t} style={{ display: "flex", alignItems: "center", gap: 8, color: c.on ? "var(--sx-text)" : "var(--sx-text-4)" }}>
                  <span style={{ color: c.on ? "var(--sx-red-soft)" : "var(--sx-text-4)" }}>{c.on ? "▲ 필요" : "● 정상"}</span>
                  <span style={{ fontWeight: 600 }}>{c.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashShell>
  );
}
