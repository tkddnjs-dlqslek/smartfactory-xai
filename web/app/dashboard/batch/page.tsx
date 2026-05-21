"use client";
/* SmartFactory XAI — Tab 3 전체 이력 일괄 분석 (DashTab3)
   원본: _design_package/smart-factory-mvp/project/design-dashboard.jsx :358-481
   디자인 1:1 매칭 — mock 데이터로 우선 구동 (백엔드 연동은 다음 단계) */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api, MetricsBundle } from "@/lib/api";

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

  // τ 민감도 시뮬레이션 — 현재 모델 실측 per-shot 점수
  const [vs, setVs] = useState<{ errors: number[]; labels: number[]; err_min: number; err_max: number } | null>(null);
  const [tau, setTau] = useState(0.32);

  useEffect(() => {
    api.metrics().then((b: MetricsBundle) => { setCm(b.ensemble?.ae_alone); setM(b.metrics); })
      .catch((e) => setErr(e.message || "지표 연결 실패"));
    api.validation().then(setVs).catch(() => {});
  }, []);

  const total = cm ? cm.tp + cm.fp + cm.fn + cm.tn : null;
  const nDefect = cm ? cm.tp + cm.fn : null;
  const nNormal = cm ? cm.tn + cm.fp : null;

  // 슬라이더 τ에서 실시간 혼동행렬 재계산
  const sim = React.useMemo(() => {
    if (!vs) return null;
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (let i = 0; i < vs.errors.length; i++) {
      const pred = vs.errors[i] >= tau ? 1 : 0;
      const y = vs.labels[i];
      if (pred && y) tp++; else if (pred && !y) fp++; else if (!pred && y) fn++; else tn++;
    }
    const prec = tp + fp ? tp / (tp + fp) : 0;
    const rec = tp + fn ? tp / (tp + fn) : 0;
    const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
    return { tp, fp, fn, tn, prec, rec, f1 };
  }, [vs, tau]);

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
          <span className="ttl">τ 민감도 시뮬레이션 · 현재 모델 실측 {vs ? vs.errors.length.toLocaleString() : "1,379"}샷</span>
          <span className="sub">슬라이더를 움직이면 혼동행렬이 실시간 재계산 <span className="tag" style={{ marginLeft: 4, color: "#FFA756" }}>LIVE 모델</span></span>
        </div>
        <div className="b">
          <svg viewBox="0 0 1300 200" preserveAspectRatio="none" style={{ width: "100%", height: 200, display: "block" }}>
            {vs && (() => {
              const lo = vs.err_min, hi = vs.err_max, rng = (hi - lo) || 1;
              const yOf = (e: number) => 190 - ((e - lo) / rng) * 180;
              const tY = yOf(tau);
              return (
                <>
                  <line x1="0" y1={tY} x2="1300" y2={tY} stroke="var(--sx-red)" strokeWidth="0.8" strokeDasharray="3 2" />
                  <text x="1295" y={tY - 4} fill="var(--sx-red-soft)" fontSize="9" fontWeight="700" textAnchor="end">τ {tau.toFixed(3)}</text>
                  {vs.errors.map((e, i) => {
                    const over = e >= tau, defect = vs.labels[i] === 1;
                    return <circle key={i} cx={(i / vs.errors.length) * 1300} cy={yOf(e)} r={defect ? 2.2 : 0.8}
                      fill={defect ? "var(--sx-red)" : (over ? "#FFA756" : "var(--sx-text-3)")} opacity={defect ? 0.95 : (over ? 0.7 : 0.45)} />;
                  })}
                </>
              );
            })()}
            {!vs && <text x="650" y="100" fill="var(--sx-text-3)" fontSize="12" textAnchor="middle">시뮬레이션 데이터 로딩…</text>}
          </svg>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <span className="eyebrow">임계값 τ</span>
            <input type="range" min={vs ? vs.err_min : 0.1} max={vs ? vs.err_max : 0.9} step={0.005} value={tau}
              onChange={(e) => setTau(Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--sx-cyan)", cursor: "pointer" }} />
            <span className="num" style={{ fontWeight: 800, color: "var(--sx-cyan)", minWidth: 46 }}>{tau.toFixed(3)}</span>
          </div>
          {sim && (
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {([["TP", sim.tp, "var(--sx-cyan)"], ["FP", sim.fp, "#FFA756"], ["FN", sim.fn, "var(--sx-red-soft)"], ["TN", sim.tn, "var(--sx-text-2)"],
                 ["Precision", sim.prec.toFixed(3), "var(--sx-cyan)"], ["Recall", sim.rec.toFixed(3), "var(--sx-text)"], ["F1", sim.f1.toFixed(3), "var(--sx-cyan)"]] as any[]).map(([k, v, c]) => (
                <div key={k} style={{ textAlign: "center" }}>
                  <div className="eyebrow">{k}</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 800, color: c }}>{typeof v === "number" ? v.toLocaleString() : v}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 9.5, color: "var(--sx-text-4)", fontWeight: 600, marginTop: 8, lineHeight: 1.5 }}>
            ● 빨강=실제 불량 · ● 주황=정상인데 τ 초과(거짓경보) · ● 회색=정상.<br />
            ※ 아래 <b>공식 혼동행렬</b>은 발표 기준 검증 스냅샷(실측 고정), 본 시뮬레이션은 <b>현재 배포 모델</b> 점수 기준이라 수치가 다릅니다 — τ 트레이드오프 시연용.
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
          <div className="h"><span className="ttl">공식 검증 혼동 행렬 · τ 고정</span><span className="sub">발표 기준 실측 · F1 0.7324 <span className="tag real" style={{ marginLeft: 4 }}>실측</span></span></div>
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
