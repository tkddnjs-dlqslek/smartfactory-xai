"use client";
/* SmartFactory XAI — Tab 4 설비 예지정비 · 누적 이상 외삽 (Predictive Maintenance)
   누적 이상 카운트·구간 이상률·최다 이상 구간 = 실측 KAMP 1,379샷에 모델이 매긴 점수(error>τ)에서 계산.
   RUL 일수 환산만 "가정"(MES 가동로그 부재 → 가동률 가정). MES 연동 시 자동 실측. */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api, SENSOR_COLS } from "@/lib/api";

// 정비 임계 (운영 정책 — 누적 이상 카운트 기준) · 가정
const TH = { warn: 30, danger: 50, crit: 80 };
const SHOTS_PER_DAY = 250; // 가정 — MES 가동 로그 연동 시 실측

const KO: Record<string, string> = {
  Max_Back_Pressure: "최대 배압", Max_Injection_Speed: "최대 사출속도", Filling_Time: "충전 시간",
  Injection_Time: "사출 시간", Cycle_Time: "사이클 시간", Max_Switch_Over_Pressure: "최대 전환압력",
  Cushion_Position: "쿠션 위치", Mold_Temperature_4: "금형온도4", Mold_Temperature_3: "금형온도3",
  Average_Back_Pressure: "평균 배압", Max_Screw_RPM: "최대 스크류RPM", Average_Screw_RPM: "평균 스크류RPM",
  Max_Injection_Pressure: "최대 사출압력", Plasticizing_Time: "가소화 시간", Plasticizing_Position: "가소화 위치",
  Clamp_Close_Time: "형체결 시간", Clamp_Open_Position: "형개방 위치", Hopper_Temperature: "호퍼 온도",
};
const ko = (s: string) => KO[s] || s;

export default function HistoryPage() {
  const [val, setVal] = useState<{ errors: number[]; labels: number[] } | null>(null);
  const [shots, setShots] = useState<number[][] | null>(null);
  const [tau, setTau] = useState<number>(0.31983);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.validation().then((d) => setVal({ errors: d.errors, labels: d.labels })).catch((e) => setErr(e.message));
    api.shots().then((d) => setShots(d.shots)).catch(() => {});
    api.health().then((h) => h.threshold && setTau(h.threshold)).catch(() => {});
  }, []);

  // 실측 집계 — 모델 이상 탐지(error>τ) 기반
  const agg = React.useMemo(() => {
    if (!val) return null;
    const { errors } = val;
    const N = errors.length;
    const anom = errors.map((e) => (e > tau ? 1 : 0));
    const total = anom.reduce((s, a) => s + a, 0);
    const rate = total / N;
    // 누적 카운트 (샷 순서대로)
    let c = 0; const cum = anom.map((a) => (c += a, c));
    // 100샷 구간
    const W = 100, nWin = Math.ceil(N / W);
    const windows = Array.from({ length: nWin }, (_, w) => {
      const lo = w * W, hi = Math.min((w + 1) * W, N);
      let cnt = 0; for (let i = lo; i < hi; i++) cnt += anom[i];
      // 구간 내 이상 샷의 주원인 센서(|z| 최대) 최빈값
      const tally: Record<string, number> = {};
      if (shots) for (let i = lo; i < hi; i++) {
        if (!anom[i]) continue;
        const z = shots[i]; let mi = 0, mv = 0;
        for (let j = 0; j < z.length; j++) if (Math.abs(z[j]) > mv) { mv = Math.abs(z[j]); mi = j; }
        const nm = SENSOR_COLS[mi]; tally[nm] = (tally[nm] || 0) + 1;
      }
      const main = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { w, lo, hi, size: hi - lo, cnt, rate: cnt / (hi - lo), main };
    });
    // 선형 외삽 (누적 이상 = slope × shot), slope = total/N anomalies/shot
    const slope = total / N;
    const shotsTo = (target: number) => slope > 0 ? Math.max(0, (target - total) / slope) : Infinity;
    const toDanger = shotsTo(TH.danger), toCrit = shotsTo(TH.crit);
    // TOP 이상 구간
    const top = [...windows].filter((x) => x.cnt > 0).sort((a, b) => b.cnt - a.cnt).slice(0, 7);
    // 최근 두 구간 추세
    const last = windows[nWin - 1], prev = windows[nWin - 2];
    return { N, anom, total, rate, cum, windows, nWin, slope, toDanger, toCrit, top, last, prev };
  }, [val, shots, tau]);

  // 큰 차트 좌표 (실측 누적선 + 외삽선)
  const chart = React.useMemo(() => {
    if (!agg) return null;
    const X0 = 48, X1 = 1280, Y0 = 250, YT = 24, ymax = 100;
    // x축: 실측 N샷 + 외삽분(긴급까지) → 전체 범위
    const xEnd = agg.N + (isFinite(agg.toCrit) ? agg.toCrit : agg.N);
    const sx = (shot: number) => X0 + (shot / xEnd) * (X1 - X0);
    const sy = (v: number) => Y0 - (Math.min(v, ymax) / ymax) * (Y0 - YT);
    // 실측 누적선 (다운샘플 ~120pt)
    const step = Math.max(1, Math.floor(agg.N / 120));
    let real = "";
    for (let i = 0; i < agg.N; i += step) real += `${sx(i + 1).toFixed(0)},${sy(agg.cum[i]).toFixed(0)} `;
    real += `${sx(agg.N).toFixed(0)},${sy(agg.total).toFixed(0)}`;
    // 외삽선 (현재점 → 긴급 임계)
    const ext = `${sx(agg.N).toFixed(0)},${sy(agg.total).toFixed(0)} ${sx(agg.N + agg.toCrit).toFixed(0)},${sy(TH.crit).toFixed(0)}`;
    const xDanger = sx(agg.N + agg.toDanger), xCrit = sx(agg.N + agg.toCrit), xNow = sx(agg.N);
    return { X0, X1, Y0, YT, sx, sy, real, ext, xDanger, xCrit, xNow, xEnd };
  }, [agg]);

  const health = agg ? Math.max(0, Math.round(100 - agg.total)) : null; // 건강도 = 100 − 누적이상
  const days = (s: number) => isFinite(s) ? (s / SHOTS_PER_DAY).toFixed(1) : "—";

  return (
    <DashShell activeTab={4} scenario="정상"
      headline="설비 예지정비 · 누적 이상 외삽"
      sub={`누적 이상·구간 이상률·TOP 구간 = AI 실측(KAMP 1,379샷) · RUL 일수 환산은 가동률 가정${err ? " · ⚠ 백엔드 미연결" : ""}`}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <div className="kpi cyan">
          <div className="lbl">누적 이상 (모델 탐지)</div>
          <div className="val num">{agg ? agg.total : "—"}<span className="u">건</span></div>
          <div className="ci">{agg ? `/ ${agg.N.toLocaleString()}샷 · error>τ` : "—"} · 실측</div>
        </div>
        <div className="kpi">
          <div className="lbl">이상률</div>
          <div className="val num">{agg ? (agg.rate * 100).toFixed(2) : "—"}<span className="u">%</span></div>
          <div className="ci">τ={tau.toFixed(3)} · 실측</div>
        </div>
        <div className="kpi red">
          <div className="lbl">위험 임계까지</div>
          <div className="val num" style={{ fontSize: 26 }}>+{agg ? Math.round(agg.toDanger).toLocaleString() : "—"}<span className="u">샷</span></div>
          <div className="ci">≈ {agg ? days(agg.toDanger) : "—"}일 (250샷/일 가정) · 외삽</div>
        </div>
        <div className="kpi">
          <div className="lbl">최근 100샷 이상률</div>
          <div className="val num">{agg?.last ? (agg.last.rate * 100).toFixed(1) : "—"}<span className="u">%</span></div>
          <div className="ci">{agg?.last && agg?.prev ? (agg.last.rate >= agg.prev.rate ? "▲ 상승" : "▼ 하락") + ` · 직전 ${(agg.prev.rate * 100).toFixed(1)}%` : "—"} · 실측</div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div className="h"><span className="ttl">누적 이상 카운트 외삽 · 정비 시점 예측</span><span className="sub">실선=실측 누적(1,379샷) · 점선=선형 외삽<span className="tag assume" style={{ marginLeft: 3 }}>외삽</span></span></div>
        <div className="b" style={{ flex: 1 }}>
          {chart && agg && (
            <svg viewBox="0 0 1300 280" style={{ width: "100%", height: 280, display: "block" }}>
              {/* y축 그리드 + 임계선 */}
              {[0, TH.warn, TH.danger, TH.crit, 100].map((y) => {
                const Y = chart.sy(y);
                const isTh = y === TH.warn || y === TH.danger || y === TH.crit;
                const col = y === TH.crit ? "var(--sx-red)" : y === TH.danger ? "#FFA756" : y === TH.warn ? "var(--sx-cyan)" : "var(--sx-border)";
                return (
                  <g key={y}>
                    <line x1={chart.X0} y1={Y} x2={chart.X1} y2={Y} stroke={col} strokeWidth={isTh ? 0.6 : 0.5} strokeDasharray={isTh ? "3 2" : undefined} />
                    <text x={chart.X0 - 6} y={Y + 3} fill="var(--sx-text-3)" fontSize="9" fontWeight="700" textAnchor="end">{y}</text>
                    {isTh && <text x={chart.X1 - 4} y={Y - 4} fill={col} fontSize="9" fontWeight="700" textAnchor="end">{y === TH.warn ? "경고" : y === TH.danger ? "위험" : "긴급"} {y}</text>}
                  </g>
                );
              })}
              <text x="14" y="135" fill="var(--sx-text-3)" fontSize="9" fontWeight="700" textAnchor="middle" transform="rotate(-90 14 135)">누적 이상</text>

              {/* 실측 누적선 */}
              <polyline points={chart.real} stroke="var(--sx-cyan)" strokeWidth="2.2" fill="none" />
              <circle cx={chart.xNow} cy={chart.sy(agg.total)} r="4" fill="var(--sx-cyan)" />
              <text x={chart.xNow + 6} y={chart.sy(agg.total) - 6} fill="var(--sx-cyan)" fontSize="10" fontWeight="800">현재 {agg.total} · {agg.N.toLocaleString()}샷</text>

              {/* 외삽선 */}
              <polyline points={chart.ext} stroke="var(--sx-red)" strokeWidth="1.6" strokeDasharray="5 3" fill="none" />

              {/* 위험/긴급 도달 수직선 */}
              <line x1={chart.xDanger} y1={chart.YT} x2={chart.xDanger} y2={chart.Y0} stroke="#FFA756" strokeWidth="0.8" strokeDasharray="2 2" />
              <text x={chart.xDanger + 5} y={chart.YT + 10} fill="#FFA756" fontSize="9" fontWeight="800">위험 +{Math.round(agg.toDanger).toLocaleString()}샷 (≈{days(agg.toDanger)}일)</text>
              <line x1={chart.xCrit} y1={chart.YT} x2={chart.xCrit} y2={chart.Y0} stroke="var(--sx-red)" strokeWidth="0.8" strokeDasharray="2 2" />
              <text x={chart.xCrit + 5} y={chart.YT + 24} fill="var(--sx-red-soft)" fontSize="9" fontWeight="800">긴급 +{Math.round(agg.toCrit).toLocaleString()}샷 (≈{days(agg.toCrit)}일)</text>

              {/* x축 라벨 */}
              {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                const shot = Math.round(f * chart.xEnd);
                return <text key={f} x={chart.sx(shot)} y="272" fill="var(--sx-text-4)" fontSize="9" fontWeight="700" textAnchor="middle">{(shot / 1000).toFixed(1)}k샷</text>;
              })}
              <line x1={chart.xNow} y1={chart.YT} x2={chart.xNow} y2={chart.Y0} stroke="var(--sx-text-3)" strokeWidth="0.5" strokeDasharray="1 3" />
            </svg>
          )}
          {!chart && <div style={{ fontSize: 11, color: "var(--sx-text-3)", padding: 20 }}>집계 중…</div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 12 }}>
        <div className="card">
          <div className="h"><span className="ttl">3단계 정비 임계</span><span className="sub">누적 이상 기준 · 정책 가정</span></div>
          <div className="b" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { lvl: "경고", n: TH.warn, c: "var(--sx-cyan)", b: "var(--sx-cyan-bd)", bg: "var(--sx-cyan-bg)", desc: "점검 일정 수립", reached: agg ? agg.total >= TH.warn : false, shot: agg ? agg.total >= TH.warn ? "도달" : `+${Math.round((TH.warn - agg.total) / agg.slope)}샷` : "—" },
              { lvl: "위험", n: TH.danger, c: "#FFA756", b: "rgba(255,167,86,0.4)", bg: "rgba(255,167,86,0.10)", desc: "정비 권장", active: true, shot: agg ? `+${Math.round(agg.toDanger).toLocaleString()}샷 ≈ ${days(agg.toDanger)}일` : "—" },
              { lvl: "긴급", n: TH.crit, c: "var(--sx-red-soft)", b: "var(--sx-red-bd)", bg: "var(--sx-red-bg)", desc: "즉시 정비 / 라인 정지", shot: agg ? `+${Math.round(agg.toCrit).toLocaleString()}샷 ≈ ${days(agg.toCrit)}일` : "—" },
            ].map((s) => (
              <div key={s.lvl} style={{ padding: "10px 12px", border: "1px solid " + s.b, background: s.bg, position: "relative" }}>
                {s.active && <span className="corner-tl"></span>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: s.c }}>● {s.lvl} {s.reached && <span style={{ fontSize: 9 }}>(도달)</span>}</div>
                  <span className="num" style={{ fontSize: 14, fontWeight: 800, color: s.c }}>≥ {s.n}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--sx-text-3)", fontWeight: 600, marginTop: 4 }}>{s.desc}</div>
                <div className="num" style={{ fontSize: 10, color: "var(--sx-text-2)", fontWeight: 700, marginTop: 4 }}>{s.shot}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">100샷 구간 이상률</span><span className="sub">{agg ? `전 ${agg.nWin}구간` : ""}</span></div>
          <div className="b">
            <svg viewBox="0 0 360 180" style={{ width: "100%", height: 180, display: "block" }}>
              <line x1="24" y1="160" x2="350" y2="160" stroke="var(--sx-border-2)" strokeWidth="0.6" />
              {agg && (() => {
                const maxCnt = Math.max(1, ...agg.windows.map((w) => w.cnt));
                const bw = Math.min(20, (326 / agg.nWin) - 3);
                return agg.windows.map((w, i) => {
                  const h = (w.cnt / maxCnt) * 130;
                  const danger = w.cnt >= 4;
                  return (
                    <g key={i}>
                      <rect x={26 + i * (326 / agg.nWin)} y={160 - h} width={bw} height={Math.max(1, h)} fill={danger ? "var(--sx-red)" : "var(--sx-text-3)"} opacity={danger ? 0.85 : 0.55} />
                      <text x={26 + i * (326 / agg.nWin) + bw / 2} y="172" fill="var(--sx-text-4)" fontSize="7" fontWeight="700" textAnchor="middle">{i + 1}</text>
                    </g>
                  );
                });
              })()}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "var(--sx-text-3)", fontWeight: 600, marginTop: 4 }}>
              <span>구간 = 100샷 단위 · y=이상 건수</span>
              <span style={{ color: "var(--sx-red-soft)" }}>{agg ? `최다 ${Math.max(...agg.windows.map((w) => w.cnt))}건` : "—"}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">최다 이상 TOP 구간</span><span className="sub">샷 구간 · 이상 건수 · 주원인</span></div>
          <div className="b" style={{ padding: 0 }}>
            <table className="tbl">
              <thead><tr><th>RANK</th><th>구간</th><th>이상</th><th>주원인 센서</th><th>이상률</th></tr></thead>
              <tbody>
                {agg && agg.top.map((w, i) => (
                  <tr key={w.w}>
                    <td className="num"><span className="tag" style={{ color: "var(--sx-text-3)" }}>#{(i + 1).toString().padStart(2, "0")}</span></td>
                    <td className="num">#{(w.lo + 1).toLocaleString()}–{w.hi.toLocaleString()}</td>
                    <td className="num" style={{ color: "var(--sx-red-soft)" }}>{w.cnt}</td>
                    <td>{w.main ? ko(w.main) : "—"}</td>
                    <td className="num">{(w.rate * 100).toFixed(0)}%</td>
                  </tr>
                ))}
                {agg && agg.top.length === 0 && <tr><td colSpan={5} style={{ fontSize: 10, color: "var(--sx-text-3)", padding: 10 }}>이상 구간 없음</td></tr>}
              </tbody>
            </table>
            <div style={{ fontSize: 9.5, color: "var(--sx-text-4)", fontWeight: 600, padding: "6px 10px", lineHeight: 1.5 }}>
              ※ 누적 이상은 우리 AI가 매 샷 실측. RUL 일수 환산(250샷/일)은 MES 가동시간 연동 시 자동 실측됩니다.
            </div>
          </div>
        </div>
      </div>
    </DashShell>
  );
}
