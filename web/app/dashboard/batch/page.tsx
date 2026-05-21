"use client";
/* SmartFactory XAI — Tab 3 전체 이력 일괄 분석 (DashTab3)
   원본: _design_package/smart-factory-mvp/project/design-dashboard.jsx :358-481
   디자인 1:1 매칭 — mock 데이터로 우선 구동 (백엔드 연동은 다음 단계) */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api, MetricsBundle, SENSOR_COLS } from "@/lib/api";

const KO: Record<string, string> = {
  Max_Back_Pressure: "최대 배압", Max_Injection_Speed: "최대 사출속도", Filling_Time: "충전 시간",
  Injection_Time: "사출 시간", Cycle_Time: "사이클 시간", Max_Switch_Over_Pressure: "최대 전환압력",
  Cushion_Position: "쿠션 위치", Mold_Temperature_4: "금형온도4", Mold_Temperature_3: "금형온도3",
  Average_Back_Pressure: "평균 배압", Max_Screw_RPM: "최대 스크류RPM", Average_Screw_RPM: "평균 스크류RPM",
  Max_Injection_Pressure: "최대 사출압력", Plasticizing_Time: "가소화 시간", Plasticizing_Position: "가소화 위치",
  Clamp_Close_Time: "형체결 시간", Clamp_Open_Position: "형개방 위치", Hopper_Temperature: "호퍼 온도",
};
const ko = (s: string) => KO[s] || s;

export default function BatchPage() {
  const [cm, setCm] = useState<any>(null);
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  // τ 민감도 시뮬레이션 — 현재 모델 실측 per-shot 점수
  const [vs, setVs] = useState<{ errors: number[]; labels: number[]; err_min: number; err_max: number } | null>(null);
  const [shots, setShots] = useState<number[][] | null>(null);
  const [tau, setTau] = useState(0.32);

  useEffect(() => {
    api.metrics().then((b: MetricsBundle) => { setCm(b.ensemble?.ae_alone); setM(b.metrics); })
      .catch((e) => setErr(e.message || "지표 연결 실패"));
    api.validation().then(setVs).catch(() => {});
    api.shots().then((d) => setShots(d.shots)).catch(() => {});
  }, []);

  // 상위 20건 이상 샷 — 검증 1,379샷에서 복원오차 내림차순 (전부 실측)
  const top20 = React.useMemo(() => {
    if (!vs) return null;
    const idx = vs.errors.map((e, i) => i).sort((a, b) => vs.errors[b] - vs.errors[a]).slice(0, 20);
    return idx.map((i, rank) => {
      let main = "—", sig = 0;
      if (shots) {
        const z = shots[i]; let mi = 0, mv = 0;
        for (let j = 0; j < z.length; j++) if (Math.abs(z[j]) > mv) { mv = Math.abs(z[j]); mi = j; }
        main = ko(SENSOR_COLS[mi]); sig = z[mi];
      }
      const e = vs.errors[i], y = vs.labels[i], pred = e >= tau ? 1 : 0;
      return { rank: rank + 1, row: i, re: e, ratio: e / tau, main, sig, gt: y, pred };
    });
  }, [vs, shots, tau]);

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <div className="card">
          <div className="h"><span className="ttl">상위 20건 이상 샷 · 복원오차 내림차순</span><span className="sub">검증 1,379샷 모델 실측 · 혼동행렬은 모델 신뢰도 탭 참조</span></div>
          <div className="b" style={{ padding: 0 }}>
            <table className="tbl">
              <thead><tr><th>RANK</th><th>SHOT</th><th>RECON</th><th>비율(×τ)</th><th>주센서 (±σ)</th><th>실제</th><th>판정</th></tr></thead>
              <tbody>
                {top20 && top20.map(r => {
                  const judge = r.pred && r.gt ? "TP" : r.pred && !r.gt ? "FP" : !r.pred && r.gt ? "FN" : "TN";
                  return (
                    <tr key={r.row}>
                      <td className="num"><span className="tag" style={{ color: "var(--sx-text-3)" }}>#{r.rank.toString().padStart(2, "0")}</span></td>
                      <td className="num">#{r.row.toString().padStart(4, "0")}</td>
                      <td className="num" style={{ color: "var(--sx-red-soft)" }}>{r.re.toFixed(4)}</td>
                      <td className="num" style={{ color: r.ratio >= 1 ? "var(--sx-red-soft)" : "var(--sx-text-3)" }}>{r.ratio.toFixed(2)}×</td>
                      <td>{r.main} <span className="num" style={{ color: "var(--sx-text-3)" }}>{r.sig >= 0 ? "+" : ""}{r.sig.toFixed(1)}σ</span></td>
                      <td>{r.gt ? <span className="tag red">DEFECT</span> : <span className="tag">NORMAL</span>}</td>
                      <td>{judge === "TP" ? <span className="tag cyan">✓ TP</span> : judge === "FP" ? <span className="tag" style={{ color: "#FFA756" }}>✗ FP</span> : judge === "FN" ? <span className="tag" style={{ color: "var(--sx-red-soft)" }}>✗ FN</span> : <span className="tag">TN</span>}</td>
                    </tr>
                  );
                })}
                {!top20 && <tr><td colSpan={7} style={{ fontSize: 11, color: "var(--sx-text-3)", padding: 12 }}>로딩…</td></tr>}
              </tbody>
            </table>
            <div style={{ fontSize: 9.5, color: "var(--sx-text-4)", fontWeight: 600, padding: "6px 10px", lineHeight: 1.5 }}>
              SHOT=검증셋 행번호 · 비율=복원오차/τ · 판정은 슬라이더 τ({tau.toFixed(3)})에 연동 · 전체 KAMP 795K는 cn7과 분포가 달라(OOD) 라벨 보유한 검증셋 기준
            </div>
          </div>
        </div>
      </div>
    </DashShell>
  );
}
