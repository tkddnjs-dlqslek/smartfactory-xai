"use client";
/* SmartFactory XAI — 안전 관리 (Safety) · 통합 플랫폼 안전 축
   센서 이상(z-score)을 안전 위험(과열·과압·기계)으로 매핑 → /predict 라이브 연동.
   고온/고압은 곧 작업자 안전 위험 → 이상탐지 엔진을 안전 모니터링에 재활용(정직한 파생). */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api, scenarioStore, analysisStore, PredictResult, Scenario, SENSOR_COLS } from "@/lib/api";

// 안전 관련 센서 그룹 → 위험 유형
const HAZARD = {
  "온도 / TEMP": { type: "과열", icon: "🔥", action: "냉각수 유량·가열대 출력 점검 · 화상 위험 구역 접근 제한", col: "#FFA756" },
  "압력 / PRESS": { type: "과압", icon: "⚠", action: "유압 라인·안전밸브 점검 · 고압 분출 위험 · 보호구 착용", col: "var(--sx-red-soft)" },
  "속도 / RPM": { type: "기계", icon: "⚙", action: "스크류 구동부 점검 · 회전체 끼임 위험 · 비상정지 확인", col: "var(--sx-cyan)" },
};
// σ 밴드 → 4단계 (관리도 기준: 2σ 경고 · 3σ 위험 · 4.5σ 긴급) — 진단 등급 체계와 정렬
const lvl = (z: number) => {
  const a = Math.abs(z);
  return a >= 4.5 ? { t: "긴급", c: "var(--sx-red-soft)", n: 4 }
    : a >= 3 ? { t: "위험", c: "var(--sx-red-soft)", n: 3 }
    : a >= 2 ? { t: "경고", c: "#FFA756", n: 2 }
    : { t: "정상", c: "var(--sx-cyan)", n: 1 };
};
// 위험 유형 → 센서 그룹 멤버 (검증셋 불량 주원인 빈도 = 발생가능성 산출용)
const GROUP_SENSORS: Record<string, string[]> = {
  "온도 / TEMP": ["Barrel_Temperature_1", "Barrel_Temperature_2", "Barrel_Temperature_3", "Barrel_Temperature_4", "Barrel_Temperature_5", "Barrel_Temperature_6", "Hopper_Temperature", "Mold_Temperature_3", "Mold_Temperature_4"],
  "압력 / PRESS": ["Max_Injection_Pressure", "Max_Switch_Over_Pressure", "Max_Back_Pressure", "Average_Back_Pressure"],
  "속도 / RPM": ["Max_Injection_Speed", "Max_Screw_RPM", "Average_Screw_RPM"],
};
const STATUS_OVERALL: Record<string, { t: string; c: string; n: number }> = {
  CRITICAL: { t: "긴급", c: "var(--sx-red-soft)", n: 4 },
  DANGER: { t: "위험", c: "var(--sx-red-soft)", n: 3 },
  WARNING: { t: "경고", c: "#FFA756", n: 2 },
  NORMAL: { t: "안전", c: "var(--sx-cyan)", n: 1 },
};

export default function SafetyPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [sel, setSel] = useState(0);
  const [r, setR] = useState<PredictResult | null>(null);
  const [shotsData, setShotsData] = useState<{ shots: number[][]; labels: number[] } | null>(null);
  const [fromLive, setFromLive] = useState(false);
  const [liveLabel, setLiveLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function loadScenario(scs?: Scenario[]) {
    const list = scs ?? scenarios;
    const stored = scenarioStore.get();
    const def = stored !== null && stored < list.length ? stored : list.length - 1;
    setSel(def); setFromLive(false);
    try { setR(await api.predict(list[def].z)); } catch (e: any) { setErr(e.message || "예측 실패"); }
  }

  useEffect(() => {
    (async () => {
      try {
        const { scenarios } = await api.scenarios();
        setScenarios(scenarios);
        const a = analysisStore.get();
        if (a.z) { setFromLive(true); setLiveLabel(a.name); setR(await api.predict(a.z)); }  // 라이브 샷 우선
        else await loadScenario(scenarios);
      } catch (e: any) { setErr(e.message || "백엔드 연결 실패"); }
    })();
    api.shots().then((d) => setShotsData({ shots: d.shots, labels: d.labels })).catch(() => {});
    return analysisStore.subscribe(() => {
      const a = analysisStore.get();
      if (a.z) { setFromLive(true); setLiveLabel(a.name); api.predict(a.z).then(setR).catch(() => {}); }
    });
  }, []);

  function backToScenario() { analysisStore.clear(); loadScenario(); }

  // 검증셋 39개 불량의 주원인(|z| 최대) 센서 → 위험유형별 발생빈도(실측 발생가능성)
  const hazardFreq = React.useMemo(() => {
    const out: Record<string, number> = { "온도 / TEMP": 0, "압력 / PRESS": 0, "속도 / RPM": 0 };
    if (!shotsData) return { freq: out, defects: 0 };
    let defects = 0;
    shotsData.labels.forEach((l, i) => {
      if (!l) return; defects++;
      const z = shotsData.shots[i]; let mi = 0, mv = 0;
      for (let j = 0; j < z.length; j++) if (Math.abs(z[j]) > mv) { mv = Math.abs(z[j]); mi = j; }
      const name = SENSOR_COLS[mi];
      for (const g of Object.keys(out)) if (GROUP_SENSORS[g].includes(name)) out[g]++;
    });
    return { freq: out, defects };
  }, [shotsData]);

  async function pick(i: number) {
    setSel(i); setErr(null); scenarioStore.set(i); analysisStore.clear(); setFromLive(false);
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
  // 종합 안전 등급 = 진단 status(권위) 그대로. 개별 위험은 σ 밴드.
  const overall = r ? STATUS_OVERALL[r.status] : { t: "—", c: "var(--sx-text-3)", n: 0 };
  const overallN = overall.n;
  // 안전 센서 정상률 (실측) — 안전관련 센서 중 |σ|<2 비율
  const safetyRows = safetyGroups.flatMap((g) => g.rows);
  const safeOk = safetyRows.filter((x) => Math.abs(x.sigma) < 2).length;
  const safeRate = safetyRows.length ? safeOk / safetyRows.length : null;

  return (
    <DashShell activeTab={5} scenario={fromLive ? liveLabel : (sel === 0 ? "정상" : scenarios[sel]?.name || "위험")}
      headline="안전 위험 모니터링 · 실시간"
      sub={`센서 이상 → 작업자 안전 위험 자동 변환 · ISO 12100 위험성 평가${err ? " · ⚠ 백엔드 미연결" : ""}`}>

      {fromLive && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", background: "var(--sx-cyan-bg)", border: "1px solid var(--sx-cyan-bd)" }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--sx-cyan)" }}>📡 라이브 샷 분석 중 · {liveLabel} — 실시간 진단에서 보낸 실제 샷</span>
          <button onClick={backToScenario} className="btn subtle" style={{ padding: "3px 12px", fontSize: 10.5, fontWeight: 700 }}>운전 상태로 돌아가기</button>
        </div>
      )}

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
        <div className={"kpi" + (overallN >= 3 ? " red" : overallN === 2 ? "" : " cyan")}>
          <div className="lbl">종합 안전 등급</div>
          <div className="val" style={{ color: overall.c }}>{overall.t}</div>
          <div className="ci">{alerts.length}건 활성 경보 · 진단 연동</div>
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
          <div className="lbl">안전센서 정상률</div>
          <div className="val num">{safeRate !== null ? (safeRate * 100).toFixed(0) : "—"}<span className="u">%</span></div>
          <div className="ci">{safetyRows.length ? `${safeOk}/${safetyRows.length} 센서 |σ|<2` : "—"} · 실측</div>
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
            <div className="h"><span className="ttl">위험성 평가 매트릭스</span><span className="sub">발생가능성(실측 불량빈도) × 심각도(현재 σ)</span></div>
            <div className="b">
              <svg viewBox="0 0 300 210" style={{ width: "100%", height: 210, display: "block" }}>
                {/* 3x3 위험 매트릭스 (행=발생가능성 높음→낮음, 열=심각도 경미→치명) */}
                {[0, 1, 2].map((row) => [0, 1, 2].map((col) => {
                  const score = (col + 1) * (3 - row);
                  const c = score >= 6 ? "var(--sx-red-bg)" : score >= 3 ? "rgba(255,167,86,0.12)" : "var(--sx-cyan-bg)";
                  const bd = score >= 6 ? "var(--sx-red-bd)" : score >= 3 ? "rgba(255,167,86,0.3)" : "var(--sx-cyan-bd)";
                  return <rect key={`${row}-${col}`} x={64 + col * 68} y={18 + row * 46} width="66" height="44" fill={c} stroke={bd} strokeWidth="0.8" />;
                }))}
                {/* 위험 플롯: x=심각도(현재 σ), y=발생가능성(실측 불량 주원인 빈도) */}
                {(() => {
                  const defects = Math.max(1, hazardFreq.defects);
                  const sevCol = (z: number) => { const a = Math.abs(z); return a >= 4 ? 2 : a >= 2 ? 1 : 0; };
                  const likRow = (g: string) => { const f = hazardFreq.freq[g] / defects; return f >= 0.3 ? 0 : f >= 0.1 ? 1 : 2; };
                  const items = [
                    { lbl: "과열", g: "온도 / TEMP", z: overheat, c: "#FFA756" },
                    { lbl: "과압", g: "압력 / PRESS", z: overpress, c: "var(--sx-red)" },
                    { lbl: "기계", g: "속도 / RPM", z: mech, c: "var(--sx-cyan)" },
                  ].filter((p) => Math.abs(p.z) >= 2).map((p) => ({ ...p, col: sevCol(p.z), row: likRow(p.g) }));
                  const seen: Record<string, number> = {};
                  return items.map((p, i) => {
                    const k = `${p.row}-${p.col}`; const off = seen[k] || 0; seen[k] = off + 1;
                    const cx = 64 + p.col * 68 + 33 + (off * 18 - (off > 0 ? 9 : 0));
                    const cy = 18 + p.row * 46 + 22;
                    return (
                      <g key={i}>
                        <circle cx={cx} cy={cy} r="11" fill={p.c} opacity="0.92" />
                        <text x={cx} y={cy + 3} fill="#fff" fontSize="8" fontWeight="800" textAnchor="middle">{p.lbl}</text>
                      </g>
                    );
                  });
                })()}
                {/* 축 라벨 */}
                <text x="165" y="12" fill="var(--sx-text-3)" fontSize="8" fontWeight="700" textAnchor="middle">심각도(σ) →</text>
                {["경미", "중대", "치명"].map((t, i) => <text key={t} x={64 + i * 68 + 33} y="190" fill="var(--sx-text-4)" fontSize="7.5" fontWeight="700" textAnchor="middle">{t}</text>)}
                <text x="12" y="110" fill="var(--sx-text-3)" fontSize="8" fontWeight="700" textAnchor="middle" transform="rotate(-90 12 110)">← 발생가능성</text>
                <text x="200" y="204" fill="var(--sx-text-4)" fontSize="7" fontWeight="600" textAnchor="end">발생가능성=불량 {hazardFreq.defects}건 주원인 빈도</text>
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
