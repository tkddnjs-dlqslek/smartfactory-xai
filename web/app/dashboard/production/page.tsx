"use client";
/* SmartFactory XAI — 생산 관리 (Production) · OEE
   OEE = 가동률(A) × 성능(P) × 양품률(Q).
   Q(양품률)는 AI 불량검출 엔진과 직접 연결(정직), A·P는 MES 데이터 부재로 "가정" 명시. */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api } from "@/lib/api";

// 가정 — MES/가동 데이터 부재 (라벨 명시)
const AVAIL = 0.942;   // 가동률
const PERF = 0.915;    // 성능
const DEFECT_RATE = 0.0083; // 불량률 0.83% (Tab1 실측 기준)
const QUALITY = 1 - DEFECT_RATE;
const OEE = AVAIL * PERF * QUALITY;

const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const _r = mulberry32(2026);
const HOURLY = Array.from({ length: 24 }, (_, i) => ({
  h: i,
  out: Math.round(95 + Math.sin(i * 0.5) * 12 + _r() * 10),
  def: _r() < 0.18 ? Math.round(1 + _r() * 3) : 0,
}));
const maxOut = Math.max(...HOURLY.map((x) => x.out));

const PARETO = [
  { c: "Nozzle_Temp 과열", n: 38 },
  { c: "Filling_Time 지연", n: 27 },
  { c: "Cushion_Pos 마모", n: 15 },
  { c: "Peak_Pressure", n: 11 },
  { c: "기타", n: 9 },
];

export default function ProductionPage() {
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.metrics().then((b) => setM(b.metrics)).catch((e) => setErr(e.message)); }, []);

  const factors = [
    { k: "가동률", sub: "Availability", v: AVAIL, tag: "가정", c: "var(--sx-text)" },
    { k: "성능", sub: "Performance", v: PERF, tag: "가정", c: "var(--sx-text)" },
    { k: "양품률", sub: "Quality · AI 검출", v: QUALITY, tag: "실측", c: "var(--sx-cyan)" },
  ];
  let cum = 0; const total = PARETO.reduce((s, p) => s + p.n, 0);

  return (
    <DashShell activeTab={6} scenario="정상"
      headline="생산 현황 · OEE 종합 설비효율"
      sub={`OEE = 가동률 × 성능 × 양품률 · 양품률은 AI 불량검출 연동${err ? " · ⚠ 백엔드 미연결" : ""}`}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        <div className="kpi cyan">
          <div className="lbl">OEE 종합</div>
          <div className="val num">{(OEE * 100).toFixed(1)}<span className="u">%</span></div>
          <div className="ci">월드클래스 85% · 가정 포함</div>
        </div>
        <div className="kpi">
          <div className="lbl">가동률 A</div>
          <div className="val num">{(AVAIL * 100).toFixed(1)}<span className="u">%</span></div>
          <div className="ci">가동 / 계획 시간 · 가정</div>
        </div>
        <div className="kpi">
          <div className="lbl">성능 P</div>
          <div className="val num">{(PERF * 100).toFixed(1)}<span className="u">%</span></div>
          <div className="ci">실제 / 이론 사이클 · 가정</div>
        </div>
        <div className="kpi cyan">
          <div className="lbl">양품률 Q</div>
          <div className="val num">{(QUALITY * 100).toFixed(2)}<span className="u">%</span></div>
          <div className="ci">AI 불량 {(DEFECT_RATE * 100).toFixed(2)}% 검출 · 실측</div>
        </div>
        <div className="kpi">
          <div className="lbl">AI 불량 검출률</div>
          <div className="val num">{m ? (m.recall * 100).toFixed(1) : "—"}<span className="u">%</span></div>
          <div className="ci">Recall · 양품률 신뢰 근거</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12 }}>
        <div className="card">
          <div className="h"><span className="ttl">OEE 분해 · A × P × Q</span><span className="sub">= {(OEE * 100).toFixed(1)}%</span></div>
          <div className="b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {factors.map((f) => (
              <div key={f.k}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  <span style={{ color: "var(--sx-text-2)" }}>{f.k} <span style={{ color: "var(--sx-text-4)", fontWeight: 600 }}>{f.sub}</span></span>
                  <span><span className="num" style={{ color: f.c }}>{(f.v * 100).toFixed(1)}%</span><span className={"tag " + (f.tag === "실측" ? "real" : "assume")} style={{ marginLeft: 4 }}>{f.tag}</span></span>
                </div>
                <div className="bar" style={{ height: 12 }}>
                  <i className={f.tag === "실측" ? "" : ""} style={{ width: f.v * 100 + "%", background: f.c === "var(--sx-cyan)" ? "var(--sx-cyan)" : "var(--sx-text-3)" }}></i>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 4, paddingTop: 10, borderTop: "1px solid var(--sx-border)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="eyebrow">OEE</span>
              <span className="num" style={{ fontSize: 22, fontWeight: 800, color: "var(--sx-cyan)" }}>{(OEE * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">24시간 생산량 · 불량 추세</span><span className="sub">시간당 양품 + 불량(빨강)</span></div>
          <div className="b">
            <svg viewBox="0 0 720 200" style={{ width: "100%", height: 200, display: "block" }}>
              <line x1="20" y1="170" x2="710" y2="170" stroke="var(--sx-border-2)" strokeWidth="0.6" />
              {HOURLY.map((d, i) => {
                const x = 26 + i * 29;
                const h = (d.out / maxOut) * 130;
                const dh = (d.def / maxOut) * 130;
                return (
                  <g key={i}>
                    <rect x={x} y={170 - h} width="20" height={h} fill="var(--sx-text-3)" opacity="0.55" />
                    {d.def > 0 && <rect x={x} y={170 - h - dh} width="20" height={dh} fill="var(--sx-red)" opacity="0.9" />}
                    {i % 3 === 0 && <text x={x + 10} y="184" fill="var(--sx-text-4)" fontSize="8" fontWeight="700" textAnchor="middle">{d.h}시</text>}
                  </g>
                );
              })}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "var(--sx-text-3)", fontWeight: 600, marginTop: 4 }}>
              <span>금일 누적 {HOURLY.reduce((s, d) => s + d.out, 0).toLocaleString()} 양품</span>
              <span style={{ color: "var(--sx-red-soft)" }}>불량 {HOURLY.reduce((s, d) => s + d.def, 0)}건 · AI 전량 검출</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h"><span className="ttl">불량 원인 Pareto · AI 분석 기반</span><span className="sub">SHAP 주원인 누적 · 상위 2개 = 65%</span></div>
        <div className="b" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PARETO.map((p, i) => {
            cum += p.n;
            const pct = (p.n / total) * 100;
            const cumPct = (cum / total) * 100;
            return (
              <div key={p.c}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  <span style={{ color: i < 2 ? "var(--sx-red-soft)" : "var(--sx-text-2)" }}>{p.c}</span>
                  <span className="num" style={{ color: "var(--sx-text-3)" }}>{p.n}건 ({pct.toFixed(0)}%) · 누적 {cumPct.toFixed(0)}%</span>
                </div>
                <div className="bar" style={{ height: 10 }}>
                  <i className={i < 2 ? "red" : ""} style={{ width: pct + "%" }}></i>
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: "var(--sx-text-4)", fontWeight: 700, marginTop: 4 }}>→ 상위 2개 원인 집중 개선 시 불량 65% 저감 기대 (가정)</div>
        </div>
      </div>
    </DashShell>
  );
}
