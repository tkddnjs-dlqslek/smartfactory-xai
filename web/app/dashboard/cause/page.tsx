"use client";
/* SmartFactory XAI — Tab 2 불량 원인 분석 (DashTab2)
   원본: _design_package/smart-factory-mvp/project/design-dashboard.jsx :215-355
   디자인 1:1 매칭 — mock 데이터로 우선 구동 (백엔드 연동은 다음 단계) */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api, scenarioStore, ShapTop } from "@/lib/api";

const KO: Record<string, string> = {
  Max_Back_Pressure: "최대 배압", Max_Injection_Speed: "최대 사출속도", Filling_Time: "충전 시간",
  Injection_Time: "사출 시간", Cycle_Time: "사이클 시간", Max_Switch_Over_Pressure: "최대 전환압력",
  Cushion_Position: "쿠션 위치", Mold_Temperature_4: "금형온도4", Mold_Temperature_3: "금형온도3",
  Average_Back_Pressure: "평균 배압", Max_Screw_RPM: "최대 스크류RPM", Average_Screw_RPM: "평균 스크류RPM",
  Max_Injection_Pressure: "최대 사출압력", Plasticizing_Time: "가소화 시간", Plasticizing_Position: "가소화 위치",
  Clamp_Close_Time: "형체결 시간", Clamp_Open_Position: "형개방 위치", Hopper_Temperature: "호퍼 온도",
  Barrel_Temperature_1: "배럴온도1", Barrel_Temperature_2: "배럴온도2", Barrel_Temperature_3: "배럴온도3",
  Barrel_Temperature_4: "배럴온도4", Barrel_Temperature_5: "배럴온도5", Barrel_Temperature_6: "배럴온도6",
};
const ko = (s: string) => KO[s] || s.replace(/_/g, " ");

export default function CausePage() {
  const [top, setTop] = useState<ShapTop[]>([]);
  const [cum, setCum] = useState<number | null>(null);
  const [recon, setRecon] = useState<number | null>(null);
  const [scName, setScName] = useState("긴급 #37");
  const [pca, setPca] = useState<any>(null);
  const [causal, setCausal] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { scenarios } = await api.scenarios();
        const stored = scenarioStore.get();
        const idx = stored !== null && stored < scenarios.length ? stored : scenarios.length - 1;
        setScName(scenarios[idx].name);
        const z = scenarios[idx].z;
        const [ex, pr] = await Promise.all([api.explain(z, 5), api.predict(z)]);
        setTop(ex.top); setCum(ex.cumulative); setRecon(pr.recon_error);
      } catch (e: any) {
        setErr(e.message || "SHAP 연결 실패");
      }
      try { setPca(await api.pca()); } catch { /* PCA optional */ }
      try { setCausal(await api.causal()); } catch { /* causal optional */ }
    })();
  }, []);

  // 실측 인과 서브그래프 — SHAP 1위 센서를 effect로, causal_graph의 실제 강한 엣지를 원인으로 연결
  const graph = React.useMemo(() => {
    if (!causal?.edges || !top.length) return null;
    const effect = top[0].name;
    const stageOf: Record<string, number> = {};
    (causal.nodes || []).forEach((n: any) => { stageOf[n.id] = n.stage; });
    let rel = (causal.edges as any[])
      .filter((e) => e.source === effect || e.target === effect)
      .map((e) => { const other = e.source === effect ? e.target : e.source; return { other, weight: e.weight, up: (stageOf[other] ?? 99) <= (stageOf[effect] ?? 0) }; })
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 4);
    // 폴백: effect에 엣지가 없으면 전체 최강 엣지 표시
    if (rel.length === 0) {
      const e = [...(causal.edges as any[])].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))[0];
      return { effect: e.target, sigma: "", rel: [{ other: e.source, weight: e.weight, up: true }], meta: causal.meta };
    }
    return { effect, sigma: top[0].sigma, rel, meta: causal.meta };
  }, [causal, top]);

  // 실측 PCA 좌표 → SVG 스케일. 2~98 percentile로 축 잡아 아웃라이어가 클러스터를 누르지 않게.
  const pcaPts = (() => {
    if (!pca?.normal_pc1) return null;
    const allX = [...pca.normal_pc1, ...pca.defect_pc1];
    const allY = [...pca.normal_pc2, ...pca.defect_pc2];
    const pc = (arr: number[], p: number) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * p)]; };
    const xmin = pc(allX, 0.02), xmax = pc(allX, 0.98), ymin = pc(allY, 0.02), ymax = pc(allY, 0.98);
    const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const sx = (v: number) => 40 + ((cl(v, xmin, xmax) - xmin) / (xmax - xmin + 1e-9)) * 396;
    const sy = (v: number) => 196 - ((cl(v, ymin, ymax) - ymin) / (ymax - ymin + 1e-9)) * 176;
    const step = Math.ceil(pca.normal_pc1.length / 320);
    const normal: [number, number][] = [];
    for (let i = 0; i < pca.normal_pc1.length; i += step) normal.push([sx(pca.normal_pc1[i]), sy(pca.normal_pc2[i])]);
    const defect: [number, number][] = pca.defect_pc1.map((v: number, i: number) => [sx(v), sy(pca.defect_pc2[i])]);
    return { normal, defect, ev: pca.explained_var };
  })();

  const maxAbs = top.length ? Math.max(...top.map(t => t.abs_shap)) : 1;
  // 워터폴: 실측 SHAP 기여를 baseline→prediction 누적. baseline = 예측 - Σ(top shap)
  const sumTop = top.reduce((s, t) => s + t.shap, 0);
  const pred = recon ?? 0;
  const base = pred - sumTop;

  return (
    <DashShell activeTab={2} scenario={scName}
      headline="불량 원인 분석 · GradientSHAP + 인과 그래프"
      sub={`${scName} · GradientExplainer < 100 ms${err ? " · ⚠ 백엔드 미연결" : ""}`}>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flex: 1, minHeight: 0 }}>
        <div className="card">
          <div className="h"><span className="ttl">▶ TOP-5 SHAP 막대 · {cum !== null ? Math.round(cum * 100) : "—"}% 누적</span><span className="sub">GradientSHAP nsamples=50</span></div>
          <div className="b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {top.map((s, i) => (
              <div key={s.name}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  <span style={{ color: i < 3 ? "var(--sx-red-soft)" : "var(--sx-text-2)" }}>#{(i + 1).toString().padStart(2, "0")} {s.name}</span>
                  <span className="num" style={{ color: "var(--sx-text-3)" }}>SHAP {s.shap.toFixed(3)} · {s.sigma}</span>
                </div>
                <div className="bar" style={{ height: 12 }}>
                  <i className={i < 3 ? "red" : ""} style={{ width: (s.abs_shap / maxAbs * 100) + "%" }}></i>
                </div>
              </div>
            ))}
            {!top.length && <div style={{ fontSize: 11, color: "var(--sx-text-3)" }}>SHAP 계산 중…</div>}
            <div style={{ fontSize: 10, color: "var(--sx-text-4)", fontWeight: 700, letterSpacing: 0.4, marginTop: 6 }}>+ 19 sensors · residual contribution</div>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">SHAP Waterfall · 누적 분해</span><span className="sub">{recon !== null ? `기준 ${base.toFixed(3)} → 예측 ${pred.toFixed(3)}` : "계산 중"}</span></div>
          <div className="b">
            <svg viewBox="0 0 460 250" style={{ width: "100%", height: 250, display: "block" }}>
              {(() => {
                if (!top.length || recon === null) return null;
                // 누적 궤적: base → +shap … → pred. 실제 최소·최대로 스케일 (감소형 워터폴도 정상 처리)
                const acc: number[] = [base]; let a = base;
                top.forEach((s) => { a += s.shap; acc.push(a); });
                const lo = Math.min(...acc, pred), hi = Math.max(...acc, base);
                const pad = (hi - lo) * 0.18 || 0.05;
                const y0 = lo - pad, y1 = hi + pad;
                const TOP = 40, BOT = 196;
                const yOf = (v: number) => BOT - ((v - y0) / (y1 - y0)) * (BOT - TOP);
                const bw = 52, gap = 78, x0 = 40;
                return (<>
                  {/* 축 */}
                  <line x1="24" y1={BOT} x2="444" y2={BOT} stroke="var(--sx-border-2)" strokeWidth="0.8" />
                  {/* 기준선 (baseline dashed) */}
                  <line x1="24" y1={yOf(base)} x2="444" y2={yOf(base)} stroke="var(--sx-text-4)" strokeWidth="0.6" strokeDasharray="3 3" opacity="0.6" />
                  <text x="24" y={yOf(base) - 4} fill="var(--sx-text-3)" fontSize="8.5" fontWeight="700">기준 {base.toFixed(3)}</text>
                  {top.map((s, i) => {
                    const before = acc[i], after = acc[i + 1];
                    const x = x0 + i * gap;
                    const yTop = yOf(Math.max(before, after));
                    const yBot = yOf(Math.min(before, after));
                    const pos = s.shap >= 0;
                    const labelAbove = yTop > TOP + 16;  // 막대가 너무 위면 라벨을 아래로
                    return (
                      <g key={s.name}>
                        <rect x={x} y={yTop} width={bw} height={Math.max(2, yBot - yTop)} fill={pos ? "var(--sx-red)" : "var(--sx-cyan)"} fillOpacity="0.78" />
                        {i < top.length - 1 && <line x1={x + bw} y1={yOf(after)} x2={x + gap} y2={yOf(after)} stroke="var(--sx-border-2)" strokeWidth="0.8" strokeDasharray="2 2" />}
                        <text x={x + bw / 2} y={labelAbove ? yTop - 5 : yBot + 12} fill={pos ? "var(--sx-red-soft)" : "var(--sx-cyan)"} fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="ui-monospace">{pos ? "+" : ""}{s.shap.toFixed(3)}</text>
                        <text x={x + bw / 2} y={BOT + 14} fill="var(--sx-text-3)" fontSize="7.5" fontWeight="700" textAnchor="middle">{(s.name.length > 11 ? s.name.slice(0, 10) + "…" : s.name).replace(/_/g, " ")}</text>
                        <text x={x + bw / 2} y={BOT + 24} fill="var(--sx-text-4)" fontSize="7.5" fontWeight="700" textAnchor="middle">{s.sigma}</text>
                      </g>
                    );
                  })}
                  {/* 예측 종점 마커 (값은 카드 헤더에 표시) */}
                  <circle cx={x0 + (top.length - 1) * gap + bw} cy={yOf(pred)} r="3.5" fill="var(--sx-red)" />
                  <text x={x0 + (top.length - 1) * gap + bw} y={yOf(pred) < TOP + 20 ? yOf(pred) + 16 : yOf(pred) - 8} fill="var(--sx-red-soft)" fontSize="8.5" fontWeight="800" textAnchor="middle">예측</text>
                </>);
              })()}
              {(!top.length || recon === null) && <text x="230" y="120" fill="var(--sx-text-3)" fontSize="11" textAnchor="middle">계산 중…</text>}
            </svg>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">인과 의존성 그래프 · {graph ? ko(graph.effect) : "—"} 연결</span><span className="sub">{graph ? `|r|≥0.4 · 사이클 시간순서 · n=${(graph.meta?.data_n ?? 0).toLocaleString()}` : "로딩"}</span></div>
          <div className="b" style={{ padding: 14 }}>
            {graph ? (
              <svg viewBox="0 0 460 280" style={{ width: "100%", height: 280, display: "block" }}>
                <defs>
                  <marker id="ca" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 Z" fill="#D42121" />
                  </marker>
                </defs>
                <text x="30" y="18" fill="var(--sx-text-3)" fontSize="9" fontWeight="700">연관 센서 (상관 강도순)</text>
                <text x="430" y="18" fill="var(--sx-text-3)" fontSize="9" fontWeight="700" textAnchor="end">SHAP 1위 (effect)</text>
                {(() => {
                  const n = graph.rel.length;
                  const ey = 140, ex = 348;
                  return (<>
                    {graph.rel.map((r, i) => {
                      const y = 40 + i * (200 / Math.max(1, n - 1 || 1)) * (n > 1 ? 1 : 0) + (n === 1 ? 100 : 0);
                      const yy = n > 1 ? 40 + i * (200 / (n - 1)) : 130;
                      const col = r.weight >= 0 ? "#D42121" : "#00D4FF";
                      const sw = 1 + Math.abs(r.weight) * 2.2;
                      return (
                        <g key={r.other}>
                          <rect x="20" y={yy} width="132" height="42" fill="rgba(212,33,33,0.12)" stroke={col} strokeWidth="1" />
                          <text x="28" y={yy + 18} fill="#FF5A4A" fontSize="10.5" fontWeight="800">{ko(r.other)}</text>
                          <text x="28" y={yy + 33} fill="#84848B" fontSize="8.5" fontWeight="700">{r.up ? "상류 공정" : "하류 공정"}</text>
                          <path d={`M 152 ${yy + 21} Q ${(152 + ex) / 2} ${(yy + 21 + ey + 26) / 2}, ${ex} ${ey + 26}`} stroke={col} strokeWidth={sw} fill="none" markerEnd="url(#ca)" opacity="0.8" />
                          <text x={(152 + ex) / 2 - 6} y={(yy + 21 + ey + 26) / 2 - 4} fill={col === "#D42121" ? "#FF5A4A" : "#00D4FF"} fontSize="9" fontWeight="800" textAnchor="middle">r={r.weight.toFixed(2)}</text>
                        </g>
                      );
                    })}
                    <rect x={ex} y={ey + 4} width="104" height="52" fill="#D42121" stroke="#D42121" />
                    <text x={ex + 52} y={ey + 26} fill="#fff" fontSize="11" fontWeight="800" textAnchor="middle">{ko(graph.effect).slice(0, 8)}</text>
                    <text x={ex + 52} y={ey + 43} fill="rgba(255,255,255,0.85)" fontSize="9" fontWeight="700" textAnchor="middle">{graph.sigma} · effect</text>
                  </>);
                })()}
              </svg>
            ) : <div style={{ fontSize: 11, color: "var(--sx-text-3)", padding: 40, textAlign: "center" }}>인과 그래프 로딩 중…</div>}
            <div style={{ fontSize: 9, color: "var(--sx-text-4)", fontWeight: 600, lineHeight: 1.5, marginTop: 2 }}>
              ※ 엣지 = Pearson |r|≥0.4 + 사출 사이클 시간순서 만족 (인과 추정). 굵기=상관 강도. PC/GES 정식 인과 알고리즘은 본선 예정.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">PCA 클러스터 · 정상 vs 이상</span><span className="sub">{pcaPts ? `설명분산 ${(pcaPts.ev[0] * 100).toFixed(0)}%+${(pcaPts.ev[1] * 100).toFixed(0)}%` : "로딩"}</span></div>
          <div className="b">
            <svg viewBox="0 0 460 224" style={{ width: "100%", height: 224, display: "block" }}>
              <line x1="40" y1="196" x2="436" y2="196" stroke="var(--sx-border-2)" strokeWidth="0.6" />
              <line x1="40" y1="16" x2="40" y2="196" stroke="var(--sx-border-2)" strokeWidth="0.6" />
              {pcaPts?.normal.map((p, i) => (
                <circle key={"n" + i} cx={p[0]} cy={p[1]} r="1.4" fill="#C8C8CD" opacity="0.4" />
              ))}
              {pcaPts?.defect.map((p, i) => (
                <circle key={"a" + i} cx={p[0]} cy={p[1]} r="3" fill="#D42121" opacity="0.9" stroke="#fff" strokeWidth="0.4" />
              ))}
              <text x="436" y="212" fill="var(--sx-text-3)" fontSize="9" fontWeight="700" textAnchor="end">PC1 ({pcaPts ? (pcaPts.ev[0] * 100).toFixed(0) : "—"}%) →</text>
              <text x="14" y="106" fill="var(--sx-text-3)" fontSize="9" fontWeight="700" textAnchor="middle" transform="rotate(-90 14 106)">PC2 ({pcaPts ? (pcaPts.ev[1] * 100).toFixed(0) : "—"}%) →</text>
              {/* 범례 (좌상단 박스) */}
              <rect x="48" y="22" width="146" height="34" fill="var(--sx-surface)" stroke="var(--sx-border)" strokeWidth="0.5" opacity="0.9" />
              <circle cx="58" cy="33" r="3" fill="#C8C8CD" /><text x="66" y="36" fill="var(--sx-text-2)" fontSize="9" fontWeight="700">정상 n={pca?.n_normal ?? "—"}</text>
              <circle cx="58" cy="47" r="3.5" fill="#D42121" stroke="#fff" strokeWidth="0.4" /><text x="66" y="50" fill="var(--sx-red-soft)" fontSize="9" fontWeight="700">이상(불량) n={pca?.n_defect ?? "—"}</text>
              {!pcaPts && <text x="238" y="110" fill="var(--sx-text-3)" fontSize="10" fontWeight="700" textAnchor="middle">PCA 로딩 중…</text>}
            </svg>
          </div>
        </div>
      </div>
    </DashShell>
  );
}
