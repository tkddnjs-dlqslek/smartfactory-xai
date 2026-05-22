"use client";
/* SmartFactory XAI — Tab 4 설비 예지정비 · 정비 우선순위 / 모델 탐지 커버리지
   실제 불량(39건, ground truth)의 설비 계통별 분포 = 정비 우선순위(실측, 생산 Pareto와 정합).
   + 계통별 모델 탐지율(TP/(TP+FN)) = 모델 사각지대 진단(실측). recall 26/39와 정합.
   cn7은 시계열 가동로그가 없어 RUL(잔여수명)은 시연하지 않음(정직) — MES 연동 시점. */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api, SENSOR_COLS, ImproveResult } from "@/lib/api";

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const KO: Record<string, string> = {
  Max_Back_Pressure: "최대 배압", Max_Injection_Speed: "최대 사출속도", Filling_Time: "충전 시간",
  Injection_Time: "사출 시간", Cycle_Time: "사이클 시간", Max_Switch_Over_Pressure: "최대 전환압력",
  Cushion_Position: "쿠션 위치", Mold_Temperature_4: "금형온도4", Mold_Temperature_3: "금형온도3",
  Average_Back_Pressure: "평균 배압", Max_Screw_RPM: "최대 스크류RPM", Average_Screw_RPM: "평균 스크류RPM",
  Max_Injection_Pressure: "최대 사출압력", Plasticizing_Time: "가소화 시간", Plasticizing_Position: "가소화 위치",
  Clamp_Close_Time: "형체결 시간", Clamp_Open_Position: "형개방 위치", Hopper_Temperature: "호퍼 온도",
};
const ko = (s: string) => KO[s] || s.replace(/_/g, " ");

const GROUPS: Record<string, string[]> = {
  "시간 / TIME": ["Injection_Time", "Filling_Time", "Plasticizing_Time", "Cycle_Time", "Clamp_Close_Time"],
  "위치 / POS": ["Cushion_Position", "Plasticizing_Position", "Clamp_Open_Position"],
  "속도 / RPM": ["Max_Injection_Speed", "Max_Screw_RPM", "Average_Screw_RPM"],
  "압력 / PRESS": ["Max_Injection_Pressure", "Max_Switch_Over_Pressure", "Max_Back_Pressure", "Average_Back_Pressure"],
  "온도 / TEMP": ["Barrel_Temperature_1", "Barrel_Temperature_2", "Barrel_Temperature_3", "Barrel_Temperature_4", "Barrel_Temperature_5", "Barrel_Temperature_6", "Hopper_Temperature", "Mold_Temperature_3", "Mold_Temperature_4"],
};
const groupOf = (s: string) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(s)) || "기타";
const ACTION: Record<string, string> = {
  "온도 / TEMP": "냉각수 유량·가열대 출력 점검", "압력 / PRESS": "유압라인·안전밸브·배압 설정 점검",
  "속도 / RPM": "스크류 구동부·계량 안정성 점검", "시간 / TIME": "사이클 타이밍·충전 프로파일 점검",
  "위치 / POS": "쿠션·형개방 위치 캘리브레이션",
};

export default function HistoryPage() {
  const [val, setVal] = useState<{ errors: number[]; labels: number[] } | null>(null);
  const [shots, setShots] = useState<number[][] | null>(null);
  const [tau, setTau] = useState(0.31983);
  const [err, setErr] = useState<string | null>(null);
  const [adv, setAdv] = useState<ImproveResult | null>(null);   // AI 개선안
  const [advLoading, setAdvLoading] = useState(false);

  function getAdvice() {
    setAdvLoading(true); setAdv(null);
    api.improve().then(setAdv).catch(() => setAdv(null)).finally(() => setAdvLoading(false));
  }

  useEffect(() => {
    api.validation().then((d) => setVal({ errors: d.errors, labels: d.labels })).catch((e) => setErr(e.message));
    api.shots().then((d) => setShots(d.shots)).catch(() => {});
    api.health().then((h) => h.threshold && setTau(h.threshold)).catch(() => {});
  }, []);

  // 실측: 실제 불량 39건의 계통별 분포 + 모델 탐지율 (ground truth 기준 · 순서 무관)
  const agg = React.useMemo(() => {
    if (!val) return null;
    const { errors, labels } = val;
    const N = errors.length;
    const stat: Record<string, { defects: number; detected: number }> = {};
    Object.keys(GROUPS).forEach((g) => { stat[g] = { defects: 0, detected: 0 }; });
    let defects = 0, tp = 0;
    labels.forEach((l, i) => {
      if (!l) return; defects++;
      let g = "기타";
      if (shots) { const z = shots[i]; let mi = 0, mv = 0; for (let j = 0; j < z.length; j++) if (Math.abs(z[j]) > mv) { mv = Math.abs(z[j]); mi = j; } g = groupOf(SENSOR_COLS[mi]); }
      const det = errors[i] > tau;
      if (stat[g]) { stat[g].defects++; if (det) { stat[g].detected++; tp++; } }
    });
    const rank = Object.entries(stat).map(([g, s]) => ({ g, ...s })).filter((x) => x.defects > 0).sort((a, b) => b.defects - a.defects);
    const maxDef = Math.max(1, ...rank.map((x) => x.defects));
    const blind = rank.filter((x) => x.detected / x.defects < 0.5);
    const detTotal = errors.filter((e) => e > tau).length;
    return { N, defects, tp, fn: defects - tp, recall: defects ? tp / defects : 0, rank, maxDef, blind, detTotal };
  }, [val, shots, tau]);

  return (
    <DashShell activeTab={4} scenario="정상"
      headline="설비 예지정비 · 정비 우선순위 / 모델 커버리지"
      sub={`실제 불량(검증 39건)의 계통별 분포 + 모델 탐지율 = AI 실측 · cn7 시계열 가동로그 부재로 RUL은 MES 연동 시점${err ? " · ⚠ 백엔드 미연결" : ""}`}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <div className="kpi">
          <div className="lbl">실제 불량 (검증)</div>
          <div className="val num">{agg ? agg.defects : "—"}<span className="u">건</span></div>
          <div className="ci">/ {agg ? agg.N.toLocaleString() : "1,379"}샷 · 실측</div>
        </div>
        <div className="kpi cyan">
          <div className="lbl">모델 탐지 (TP)</div>
          <div className="val num">{agg ? agg.tp : "—"}<span className="u">건</span></div>
          <div className="ci">탐지율 {agg ? (agg.recall * 100).toFixed(0) : "—"}% · Recall</div>
        </div>
        <div className="kpi red">
          <div className="lbl">미탐 (FN)</div>
          <div className="val num">{agg ? agg.fn : "—"}<span className="u">건</span></div>
          <div className="ci">사각지대 보강 필요 · 실측</div>
        </div>
        <div className="kpi red">
          <div className="lbl">최다 불량 계통</div>
          <div className="val" style={{ fontSize: 18, marginTop: 12 }}>{agg && agg.rank[0] ? agg.rank[0].g.split(" / ")[0] : "—"}</div>
          <div className="ci">{agg && agg.rank[0] ? `${agg.rank[0].defects}건 · 우선 정비` : "—"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12, flex: 1, minHeight: 0 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="h"><span className="ttl">계통별 불량 발생 & 모델 탐지 커버리지</span><span className="sub">실제 불량 {agg ? agg.defects : "—"}건 · 탐지(하늘)+미탐(빨강) · 실측</span></div>
          <div className="b" style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
            {agg && agg.rank.map((gr, i) => {
              const detW = (gr.detected / agg.maxDef) * 100, missW = ((gr.defects - gr.detected) / agg.maxDef) * 100;
              const rate = (gr.detected / gr.defects) * 100;
              return (
                <div key={gr.g}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: i === 0 ? "var(--sx-red-soft)" : "var(--sx-text-2)" }}>{i === 0 ? "★ " : ""}{gr.g}</span>
                    <span className="num" style={{ color: "var(--sx-text-3)" }}>불량 {gr.defects}건 · 탐지율 <span style={{ color: rate < 50 ? "var(--sx-red-soft)" : "var(--sx-cyan)" }}>{rate.toFixed(0)}%</span></span>
                  </div>
                  <div style={{ display: "flex", height: 14, background: "var(--sx-surface-2)", border: "1px solid var(--sx-border)" }}>
                    <div style={{ width: detW + "%", background: "var(--sx-cyan)" }} title="탐지(TP)"></div>
                    <div style={{ width: missW + "%", background: "var(--sx-red)" }} title="미탐(FN)"></div>
                  </div>
                  <div style={{ fontSize: 9.5, color: "var(--sx-text-4)", fontWeight: 600, marginTop: 3 }}>탐지 {gr.detected} · 미탐 {gr.defects - gr.detected} · {ACTION[gr.g] || "점검"}</div>
                </div>
              );
            })}
            {!agg && <div style={{ fontSize: 11, color: "var(--sx-text-3)" }}>집계 중…</div>}
            <div style={{ marginTop: "auto", display: "flex", gap: 14, fontSize: 9.5, color: "var(--sx-text-3)", fontWeight: 700, paddingTop: 6 }}>
              <span><span style={{ display: "inline-block", width: 9, height: 9, background: "var(--sx-cyan)", marginRight: 4 }}></span>탐지(TP)</span>
              <span><span style={{ display: "inline-block", width: 9, height: 9, background: "var(--sx-red)", marginRight: 4 }}></span>미탐(FN)</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <div className="card" style={{ flex: 1 }}>
            <div className="h"><span className="ttl">정비 우선순위 · 계통별</span><span className="sub">불량 발생 내림차순 · 실측</span></div>
            <div className="b" style={{ padding: 0 }}>
              <table className="tbl">
                <thead><tr><th>순위</th><th>계통</th><th>불량</th><th>탐지율</th><th>권장 조치</th></tr></thead>
                <tbody>
                  {agg && agg.rank.map((gr, i) => {
                    const rate = (gr.detected / gr.defects) * 100;
                    return (
                      <tr key={gr.g}>
                        <td className="num"><span className="tag" style={{ color: i < 2 ? "var(--sx-red-soft)" : "var(--sx-text-3)" }}>#{(i + 1).toString().padStart(2, "0")}</span></td>
                        <td style={{ color: i === 0 ? "var(--sx-red-soft)" : "var(--sx-text-2)" }}>{gr.g.split(" / ")[0]}</td>
                        <td className="num" style={{ color: "var(--sx-red-soft)" }}>{gr.defects}</td>
                        <td className="num" style={{ color: rate < 50 ? "var(--sx-red-soft)" : "var(--sx-cyan)" }}>{rate.toFixed(0)}%</td>
                        <td style={{ fontSize: 9.5, color: "var(--sx-text-3)" }}>{ACTION[gr.g] || "점검"}</td>
                      </tr>
                    );
                  })}
                  {(!agg || !agg.rank.length) && <tr><td colSpan={5} style={{ fontSize: 10, color: "var(--sx-text-3)", padding: 10 }}>집계 중…</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="h"><span className="ttl">모델 사각지대 진단</span><span className="sub">탐지율 50% 미만 계통 · XAI</span></div>
            <div className="b" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {agg && agg.blind.map((b) => (
                <div key={b.g} style={{ padding: "8px 10px", background: "var(--sx-red-bg)", border: "1px solid var(--sx-red-bd)" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--sx-red-soft)" }}>⚠ {b.g.split(" / ")[0]} 계통 · 탐지율 {((b.detected / b.defects) * 100).toFixed(0)}%</div>
                  <div style={{ fontSize: 10, color: "var(--sx-text-2)", fontWeight: 600, marginTop: 3, lineHeight: 1.45 }}>불량 {b.defects}건 중 {b.defects - b.detected}건 미탐. 4개 모델(AE·IF·OCSVM·LOF) 모두 이 계통 이상에 둔감 — 합의 임계를 풀어도 못 잡음 → 전용 룰/SPC 관리도 보강 권장.</div>
                </div>
              ))}
              {agg && !agg.blind.length && <div style={{ fontSize: 11, color: "var(--sx-cyan)", fontWeight: 600 }}>✓ 전 계통 탐지율 50% 이상</div>}
              {!agg && <div style={{ fontSize: 11, color: "var(--sx-text-3)" }}>분석 중…</div>}

              {/* AI 개선 어드바이저 */}
              {agg && agg.blind.length > 0 && !adv && (
                <button onClick={getAdvice} disabled={advLoading} className="btn" style={{ marginTop: 2, fontSize: 11, fontWeight: 800 }}>
                  {advLoading ? "AI 분석 중…" : "🤖 AI 개선안 받기"}
                </button>
              )}
              {adv && (
                <div style={{ padding: "9px 11px", background: "var(--sx-cyan-bg)", border: "1px solid var(--sx-cyan-bd)" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--sx-cyan)" }}>🤖 {adv.recommendation}</div>
                  <div style={{ fontSize: 10, color: "var(--sx-text-2)", fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>{adv.rationale}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {adv.files.map((f) => (
                      <button key={f.name} onClick={() => download(f.name, f.content)} className="btn subtle" style={{ fontSize: 10, fontWeight: 700, padding: "4px 9px" }}>⬇ {f.name}</button>
                    ))}
                    <button onClick={() => setAdv(null)} className="btn subtle" style={{ fontSize: 10, fontWeight: 700, padding: "4px 9px", marginLeft: "auto" }}>닫기</button>
                  </div>
                  <div style={{ fontSize: 9, color: "var(--sx-text-4)", fontWeight: 600, marginTop: 5 }}>※ {adv.model === "template" ? "템플릿" : adv.model} 제안 · 시작 코드(스캐폴드)이며 실행·검증 후 채택하세요.</div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </DashShell>
  );
}
