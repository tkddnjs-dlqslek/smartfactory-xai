"use client";
/* SmartFactory XAI — 생산 관리 (Production) · OEE
   양품률·생산분포·불량 Pareto = 실측 KAMP 1,379샷에서 계산.
   가동률(A)·성능(P)은 MES/가동 로그 부재 → "가정"으로 명시 (MES 연동 시 자동 실측). */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api, SENSOR_COLS } from "@/lib/api";

// 가정 — MES 가동 로그 연동 시 실측으로 대체
const AVAIL = 0.942;   // 가동률
const PERF = 0.915;    // 성능

const KO: Record<string, string> = {
  Max_Back_Pressure: "최대 배압", Max_Injection_Speed: "최대 사출속도", Filling_Time: "충전 시간",
  Injection_Time: "사출 시간", Cycle_Time: "사이클 시간", Max_Switch_Over_Pressure: "최대 전환압력",
  Cushion_Position: "쿠션 위치", Mold_Temperature_4: "금형온도4", Mold_Temperature_3: "금형온도3",
  Average_Back_Pressure: "평균 배압", Max_Screw_RPM: "최대 스크류RPM", Average_Screw_RPM: "평균 스크류RPM",
};
const ko = (s: string) => KO[s] || s;

export default function ProductionPage() {
  const [m, setM] = useState<any>(null);
  const [shotsData, setShotsData] = useState<{ shots: number[][]; labels: number[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.metrics().then((b) => setM(b.metrics)).catch((e) => setErr(e.message));
    api.shots().then((d) => setShotsData({ shots: d.shots, labels: d.labels })).catch(() => {});
  }, []);

  // 실측 집계 (KAMP 1,379샷)
  const agg = React.useMemo(() => {
    if (!shotsData) return null;
    const { shots, labels } = shotsData;
    const total = labels.length, defect = labels.reduce((s, l) => s + l, 0), good = total - defect;
    const quality = good / total;
    // 12구간 양품/불량
    const NB = 12, sz = Math.ceil(total / NB);
    const bins = Array.from({ length: NB }, (_, b) => {
      let g = 0, d = 0;
      for (let i = b * sz; i < Math.min((b + 1) * sz, total); i++) (labels[i] ? d++ : g++);
      return { g, d };
    });
    // 불량 39건의 주원인 센서(|z| 최대) Pareto
    const tally: Record<string, number> = {};
    labels.forEach((l, i) => {
      if (!l) return;
      const z = shots[i]; let mi = 0, mv = 0;
      for (let j = 0; j < z.length; j++) if (Math.abs(z[j]) > mv) { mv = Math.abs(z[j]); mi = j; }
      const name = SENSOR_COLS[mi]; tally[name] = (tally[name] || 0) + 1;
    });
    let pareto = Object.entries(tally).map(([c, n]) => ({ c, n })).sort((a, b) => b.n - a.n);
    if (pareto.length > 5) {
      const top = pareto.slice(0, 5), etc = pareto.slice(5).reduce((s, p) => s + p.n, 0);
      pareto = [...top, { c: "기타", n: etc }];
    }
    return { total, defect, good, quality, bins, maxBin: Math.max(...bins.map((x) => x.g + x.d)), pareto };
  }, [shotsData]);

  const QUALITY = agg ? agg.quality : null;
  const OEE = QUALITY ? AVAIL * PERF * QUALITY : null;

  const factors = [
    { k: "가동률", sub: "Availability · MES 연동 시 실측", v: AVAIL, tag: "가정", c: "var(--sx-text)" },
    { k: "성능", sub: "Performance · MES 연동 시 실측", v: PERF, tag: "가정", c: "var(--sx-text)" },
    { k: "양품률", sub: "Quality · AI 불량검출 실측", v: QUALITY ?? 0, tag: "실측", c: "var(--sx-cyan)" },
  ];

  return (
    <DashShell activeTab={6} scenario="정상"
      headline="생산 현황 · OEE 종합 설비효율"
      sub={`양품률·생산분포·불량원인 = AI 실측(KAMP 1,379샷) · 가동률·성능은 MES 연동 지점${err ? " · ⚠ 백엔드 미연결" : ""}`}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        <div className="kpi cyan">
          <div className="lbl">OEE 종합</div>
          <div className="val num">{OEE ? (OEE * 100).toFixed(1) : "—"}<span className="u">%</span></div>
          <div className="ci">A×P×Q · 양품률만 실측</div>
        </div>
        <div className="kpi">
          <div className="lbl">가동률 A</div>
          <div className="val num">{(AVAIL * 100).toFixed(1)}<span className="u">%</span></div>
          <div className="ci">MES 연동 지점 · 가정</div>
        </div>
        <div className="kpi">
          <div className="lbl">성능 P</div>
          <div className="val num">{(PERF * 100).toFixed(1)}<span className="u">%</span></div>
          <div className="ci">MES 연동 지점 · 가정</div>
        </div>
        <div className="kpi cyan">
          <div className="lbl">양품률 Q</div>
          <div className="val num">{QUALITY ? (QUALITY * 100).toFixed(2) : "—"}<span className="u">%</span></div>
          <div className="ci">{agg ? `불량 ${agg.defect}/${agg.total.toLocaleString()} (${((1 - agg.quality) * 100).toFixed(2)}%)` : "—"} · 실측</div>
        </div>
        <div className="kpi">
          <div className="lbl">AI 불량 검출률</div>
          <div className="val num">{m ? (m.recall * 100).toFixed(1) : "—"}<span className="u">%</span></div>
          <div className="ci">Recall · 양품률 신뢰 근거</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12 }}>
        <div className="card">
          <div className="h"><span className="ttl">OEE 분해 · A × P × Q</span><span className="sub">= {OEE ? (OEE * 100).toFixed(1) : "—"}%</span></div>
          <div className="b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {factors.map((f) => (
              <div key={f.k}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  <span style={{ color: "var(--sx-text-2)" }}>{f.k} <span style={{ color: "var(--sx-text-4)", fontWeight: 600 }}>{f.sub}</span></span>
                  <span><span className="num" style={{ color: f.c }}>{(f.v * 100).toFixed(1)}%</span><span className={"tag " + (f.tag === "실측" ? "real" : "assume")} style={{ marginLeft: 4 }}>{f.tag}</span></span>
                </div>
                <div className="bar" style={{ height: 12 }}>
                  <i style={{ width: f.v * 100 + "%", background: f.c === "var(--sx-cyan)" ? "var(--sx-cyan)" : "var(--sx-text-3)" }}></i>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 4, paddingTop: 10, borderTop: "1px solid var(--sx-border)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="eyebrow">OEE</span>
              <span className="num" style={{ fontSize: 22, fontWeight: 800, color: "var(--sx-cyan)" }}>{OEE ? (OEE * 100).toFixed(1) : "—"}%</span>
            </div>
            <div style={{ fontSize: 9.5, color: "var(--sx-text-4)", fontWeight: 600, lineHeight: 1.5 }}>
              ※ 양품률은 우리 AI가 실시간 산출. 가동률·성능은 설비 MES(가동시간·사이클타임) 연동 시 자동 실측됩니다.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">생산 품질 분포 · 검증 {agg ? agg.total.toLocaleString() : "1,379"}샷</span><span className="sub">12구간 · 양품(회색)+불량(빨강) <span className="tag real" style={{ marginLeft: 4 }}>실측</span></span></div>
          <div className="b">
            <svg viewBox="0 0 720 200" style={{ width: "100%", height: 200, display: "block" }}>
              {/* y축 + 그리드 */}
              {agg && [0, 0.5, 1].map((f) => {
                const y = 175 - f * 150, val = Math.round(agg.maxBin * f);
                return (
                  <g key={f}>
                    <line x1="44" y1={y} x2="710" y2={y} stroke="var(--sx-border)" strokeWidth="0.5" />
                    <text x="38" y={y + 3} fill="var(--sx-text-4)" fontSize="8.5" fontWeight="700" textAnchor="end">{val}</text>
                  </g>
                );
              })}
              <text x="12" y="100" fill="var(--sx-text-3)" fontSize="9" fontWeight="700" textAnchor="middle" transform="rotate(-90 12 100)">샷 수</text>
              {agg && agg.bins.map((d, i) => {
                const bw = 48, x = 52 + i * 55;
                const gh = (d.g / agg.maxBin) * 150, dh = (d.d / agg.maxBin) * 150;
                return (
                  <g key={i}>
                    <rect x={x} y={175 - gh} width={bw} height={gh} fill="var(--sx-text-3)" opacity="0.5" />
                    {d.d > 0 && <rect x={x} y={175 - gh - dh} width={bw} height={Math.max(2, dh)} fill="var(--sx-red)" opacity="0.95" />}
                    <text x={x + bw / 2} y="190" fill="var(--sx-text-4)" fontSize="8" fontWeight="700" textAnchor="middle">{i + 1}</text>
                  </g>
                );
              })}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "var(--sx-text-3)", fontWeight: 600, marginTop: 4 }}>
              <span>양품 {agg ? agg.good.toLocaleString() : "—"}샷 · x축=100샷 구간</span>
              <span style={{ color: "var(--sx-red-soft)" }}>불량 {agg ? agg.defect : "—"}건 (실측)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h"><span className="ttl">불량 원인 Pareto · 실측 {agg ? agg.defect : 39}건 주원인 센서</span><span className="sub">불량 샷의 최대 이상(|σ|) 센서 집계 <span className="tag real" style={{ marginLeft: 4 }}>실측</span></span></div>
        <div className="b" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {agg && (() => {
            const tot = agg.pareto.reduce((s, p) => s + p.n, 0); let cum = 0;
            return agg.pareto.map((p, i) => {
              cum += p.n; const pct = (p.n / tot) * 100, cumPct = (cum / tot) * 100;
              return (
                <div key={p.c}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: i < 2 ? "var(--sx-red-soft)" : "var(--sx-text-2)" }}>{ko(p.c)}</span>
                    <span className="num" style={{ color: "var(--sx-text-3)" }}>{p.n}건 ({pct.toFixed(0)}%) · 누적 {cumPct.toFixed(0)}%</span>
                  </div>
                  <div className="bar" style={{ height: 10 }}><i className={i < 2 ? "red" : ""} style={{ width: pct + "%" }}></i></div>
                </div>
              );
            });
          })()}
          {!agg && <div style={{ fontSize: 11, color: "var(--sx-text-3)" }}>집계 중…</div>}
          <div style={{ fontSize: 10, color: "var(--sx-text-4)", fontWeight: 700, marginTop: 4 }}>→ 상위 원인 센서 집중 개선 시 불량 대폭 저감 (실측 불량 주원인 분포)</div>
        </div>
      </div>
    </DashShell>
  );
}
