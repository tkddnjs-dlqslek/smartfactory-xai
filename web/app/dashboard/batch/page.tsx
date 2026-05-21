"use client";
/* SmartFactory XAI — Tab 3 전체 이력 일괄 분석 (DashTab3)
   원본: _design_package/smart-factory-mvp/project/design-dashboard.jsx :358-481
   디자인 1:1 매칭 — mock 데이터로 우선 구동 (백엔드 연동은 다음 단계) */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api, MetricsBundle } from "@/lib/api";

const ANOMS = [
  { i: 120, v: 0.41 }, { i: 230, v: 0.32 }, { i: 345, v: 0.51 },
  { i: 512, v: 0.28 }, { i: 618, v: 0.38 }, { i: 740, v: 0.44 },
  { i: 880, v: 0.36 }, { i: 990, v: 0.55 }, { i: 1080, v: 0.29 },
  { i: 1180, v: 0.47 }, { i: 1250, v: 0.39 }, { i: 1295, v: 0.42 },
];

const TOP20 = [
  { r: 1, s: "#0,991", t: "2026-05-12 09:34", re: 0.553, so: 0.984, m: "Filling +5.1σ", sh: 0.291, gt: "DEFECT", pr: "DEFECT" },
  { r: 2, s: "#1,248", t: "2026-05-19 14:32", re: 0.412, so: 0.957, m: "Nozzle +4.8σ", sh: 0.310, gt: "DEFECT", pr: "DEFECT" },
  { r: 3, s: "#0,672", t: "2026-04-28 11:18", re: 0.402, so: 0.921, m: "Cushion +4.2σ", sh: 0.268, gt: "DEFECT", pr: "DEFECT" },
  { r: 4, s: "#0,415", t: "2026-03-22 16:09", re: 0.388, so: 0.901, m: "Peak P. +3.9σ", sh: 0.241, gt: "DEFECT", pr: "DEFECT" },
  { r: 5, s: "#1,168", t: "2026-05-17 22:48", re: 0.371, so: 0.872, m: "Hot Run. +3.2σ", sh: 0.218, gt: "DEFECT", pr: "DEFECT" },
  { r: 6, s: "#0,811", t: "2026-05-04 04:55", re: 0.354, so: 0.844, m: "Mold A +2.9σ", sh: 0.196, gt: "DEFECT", pr: "DEFECT" },
  { r: 7, s: "#0,532", t: "2026-04-11 17:21", re: 0.328, so: 0.798, m: "Inject_P +2.7σ", sh: 0.184, gt: "DEFECT", pr: "DEFECT" },
  { r: 8, s: "#0,247", t: "2026-02-19 13:02", re: 0.305, so: 0.762, m: "Cycle +2.4σ", sh: 0.165, gt: "NORMAL", pr: "DEFECT" },
];

export default function BatchPage() {
  const [cm, setCm] = useState<any>(null);
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.metrics().then((b: MetricsBundle) => { setCm(b.ensemble?.ae_alone); setM(b.metrics); })
      .catch((e) => setErr(e.message || "지표 연결 실패"));
  }, []);

  const total = cm ? cm.tp + cm.fp + cm.fn + cm.tn : null;
  const nDefect = cm ? cm.tp + cm.fn : null;
  const nNormal = cm ? cm.tn + cm.fp : null;

  return (
    <DashShell activeTab={3} scenario="정상"
      headline={`전체 이력 일괄 분석 · 검증 ${total ? total.toLocaleString() : "1,379"}샷`}
      sub={`AE 기준 혼동행렬 · 실측${err ? " · ⚠ 백엔드 미연결" : ""}`}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <div className="kpi"><div className="lbl">총 샷</div><div className="val num">{total ? total.toLocaleString() : "—"}</div><div className="ci">정상 {nNormal ?? "—"} + 불량 {nDefect ?? "—"} · 실측</div></div>
        <div className="kpi cyan"><div className="lbl">탐지 (TP)</div><div className="val num">{cm ? cm.tp : "—"}</div><div className="ci">/ {nDefect ?? "—"} · Recall {m ? m.recall.toFixed(4) : "—"}</div></div>
        <div className="kpi red"><div className="lbl">미탐지 (FN)</div><div className="val num">{cm ? cm.fn : "—"}</div><div className="ci">/ {nDefect ?? "—"} · 추가 분석 필요</div></div>
        <div className="kpi"><div className="lbl">거짓 알람 (FP)</div><div className="val num">{cm ? cm.fp : "—"}</div><div className="ci">/ {nNormal ?? "—"} · {cm && nNormal ? (cm.fp / nNormal * 100).toFixed(2) : "—"}%</div></div>
      </div>

      <div className="card">
        <div className="h">
          <span className="ttl">검증셋 시계열 · 1,379샷 복원 오차</span>
          <span className="sub">τ = 0.184 (이동) · 임계값 슬라이더로 즉시 재계산</span>
        </div>
        <div className="b">
          <svg viewBox="0 0 1300 200" preserveAspectRatio="none" style={{ width: "100%", height: 200, display: "block" }}>
            <line x1="0" y1={200 - 0.184 / 0.6 * 180} x2="1300" y2={200 - 0.184 / 0.6 * 180} stroke="var(--sx-red)" strokeWidth="0.6" strokeDasharray="3 2" />
            <text x="1295" y={200 - 0.184 / 0.6 * 180 - 4} fill="var(--sx-red-soft)" fontSize="9" fontWeight="700" textAnchor="end">τ 0.184</text>
            {NORMAL_PTS.map((p, i) => (
              <circle key={"n" + i} cx={p.x} cy={p.y} r="0.9" fill="var(--sx-text-3)" opacity="0.6" />
            ))}
            {ANOMS.map((a, i) => (
              <circle key={"a" + i} cx={(a.i / 1379) * 1300} cy={200 - a.v / 0.6 * 180} r="2.5" fill="var(--sx-red)" />
            ))}
          </svg>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <span className="eyebrow">임계값 τ</span>
            <div style={{ flex: 1, position: "relative", height: 6, background: "var(--sx-surface-3)" }}>
              <div style={{ position: "absolute", left: 0, height: "100%", width: "30%", background: "var(--sx-cyan-bg-2)" }}></div>
              <div style={{ position: "absolute", left: "30%", height: "100%", right: 0, background: "var(--sx-red-bg-2)" }}></div>
              <div style={{ position: "absolute", left: "30%", top: -4, width: 14, height: 14, background: "var(--sx-cyan)", transform: "translateX(-50%)" }}></div>
            </div>
            <span className="num" style={{ fontWeight: 800, color: "var(--sx-cyan)" }}>0.184</span>
            <span className="tag cyan">F1 0.7324</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div className="card">
          <div className="h"><span className="ttl">상위 20건 이상 샷 · 정렬 가능</span><span className="sub">복원 오차 내림차순 · KAMP 실측</span></div>
          <div className="b" style={{ padding: 0 }}>
            <table className="tbl">
              <thead><tr><th>RANK</th><th>SHOT</th><th>TIMESTAMP</th><th>RECON</th><th>4-AI SOFT</th><th>주센서</th><th>SHAP</th><th>실제</th><th>예측</th></tr></thead>
              <tbody>
                {TOP20.map(r => (
                  <tr key={r.s}>
                    <td className="num"><span className="tag" style={{ color: "var(--sx-text-3)" }}>#{r.r.toString().padStart(2, "0")}</span></td>
                    <td className="num">{r.s}</td>
                    <td className="num">{r.t}</td>
                    <td className="num" style={{ color: "var(--sx-red-soft)" }}>{r.re.toFixed(3)}</td>
                    <td className="num" style={{ color: "var(--sx-cyan)" }}>{r.so.toFixed(3)}</td>
                    <td>{r.m}</td>
                    <td className="num">{r.sh.toFixed(3)}</td>
                    <td>{r.gt === "DEFECT" ? <span className="tag red">DEFECT</span> : <span className="tag">NORMAL</span>}</td>
                    <td>{r.pr === r.gt ? <span className="tag cyan">✓</span> : <span className="tag" style={{ color: "var(--sx-red-soft)" }}>✗ FP</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">현재 τ 기준 혼동 행렬</span><span className="sub">τ = 0.184 · F1 0.7324</span></div>
          <div className="b">
            <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr", gridTemplateRows: "24px 1fr 1fr", gap: 4 }}>
              <div></div>
              <div style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "var(--sx-text-3)", letterSpacing: 0.6 }}>PRED N</div>
              <div style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "var(--sx-text-3)", letterSpacing: 0.6 }}>PRED D</div>
              <div style={{ display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, color: "var(--sx-text-3)" }}>TRUE N</div>
              <div style={{ background: "var(--sx-cyan-bg)", border: "1px solid var(--sx-cyan-bd)", padding: "14px 10px", textAlign: "center" }}>
                <div className="num" style={{ fontSize: 26, color: "var(--sx-cyan)", fontWeight: 800 }}>{cm ? cm.tn.toLocaleString() : "—"}</div>
                <div className="eyebrow" style={{ color: "var(--sx-cyan)" }}>TN</div>
              </div>
              <div style={{ background: "var(--sx-red-bg)", border: "1px solid var(--sx-red-bd)", padding: "14px 10px", textAlign: "center" }}>
                <div className="num" style={{ fontSize: 26, color: "var(--sx-red-soft)", fontWeight: 800 }}>{cm ? cm.fp : "—"}</div>
                <div className="eyebrow" style={{ color: "var(--sx-red-soft)" }}>FP</div>
              </div>
              <div style={{ display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, color: "var(--sx-text-3)" }}>TRUE D</div>
              <div style={{ background: "var(--sx-red-bg)", border: "1px solid var(--sx-red-bd)", padding: "14px 10px", textAlign: "center" }}>
                <div className="num" style={{ fontSize: 26, color: "var(--sx-red-soft)", fontWeight: 800 }}>{cm ? cm.fn : "—"}</div>
                <div className="eyebrow" style={{ color: "var(--sx-red-soft)" }}>FN</div>
              </div>
              <div style={{ background: "var(--sx-cyan-bg)", border: "1px solid var(--sx-cyan-bd)", padding: "14px 10px", textAlign: "center" }}>
                <div className="num" style={{ fontSize: 26, color: "var(--sx-cyan)", fontWeight: 800 }}>{cm ? cm.tp : "—"}</div>
                <div className="eyebrow" style={{ color: "var(--sx-cyan)" }}>TP</div>
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--sx-border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
              <div><span className="eyebrow">Precision</span><div className="num" style={{ fontSize: 16, fontWeight: 800, color: "var(--sx-cyan)" }}>{m ? m.precision.toFixed(4) : "—"}</div></div>
              <div><span className="eyebrow">Recall</span><div className="num" style={{ fontSize: 16, fontWeight: 800, color: "var(--sx-text)" }}>{m ? m.recall.toFixed(4) : "—"}</div></div>
              <div><span className="eyebrow">F1</span><div className="num" style={{ fontSize: 16, fontWeight: 800, color: "var(--sx-cyan)" }}>{m ? m.f1.toFixed(4) : "—"}</div></div>
              <div><span className="eyebrow">FPR</span><div className="num" style={{ fontSize: 16, fontWeight: 800, color: "var(--sx-text)" }}>{cm && nNormal ? (cm.fp / nNormal).toFixed(4) : "—"}</div></div>
            </div>
          </div>
        </div>
      </div>
    </DashShell>
  );
}

/* 시계열 정상 점군 — 고정 시드 좌표 (하이드레이션 안전) */
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const _r = mulberry32(1379);
const NORMAL_PTS = Array.from({ length: 350 }, (_, i) => {
  const x = (i / 349) * 1300;
  const v = 0.07 + Math.sin(i * 0.18) * 0.025 + _r() * 0.03;
  return { x, y: 200 - v / 0.6 * 180 };
});
