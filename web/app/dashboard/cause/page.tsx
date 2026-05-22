"use client";
/* SmartFactory XAI — Tab 2 불량 원인 분석 (DashTab2)
   원본: _design_package/smart-factory-mvp/project/design-dashboard.jsx :215-355
   디자인 1:1 매칭 — mock 데이터로 우선 구동 (백엔드 연동은 다음 단계) */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api, scenarioStore, analysisStore, ShapTop } from "@/lib/api";

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
  const [wf, setWf] = useState<{ base: number; pred: number; rest: number; rest_n: number } | null>(null);
  const [scName, setScName] = useState("긴급 #37");
  const [pca, setPca] = useState<any>(null);
  const [causal, setCausal] = useState<any>(null);
  const [fromLive, setFromLive] = useState(false);  // 라이브 샷 분석 중 여부
  const [err, setErr] = useState<string | null>(null);

  async function analyze(z: number[], name: string) {
    setScName(name);
    try {
      const [ex, pr] = await Promise.all([api.explain(z, 5), api.predict(z)]);
      setTop(ex.top); setCum(ex.cumulative); setRecon(pr.recon_error);
      if (ex.base !== undefined && ex.pred !== undefined && ex.rest !== undefined)
        setWf({ base: ex.base, pred: ex.pred, rest: ex.rest, rest_n: ex.rest_n ?? 19 });
    } catch (e: any) { setErr(e.message || "SHAP 연결 실패"); }
  }
  async function loadScenario() {
    const { scenarios } = await api.scenarios();
    const stored = scenarioStore.get();
    const idx = stored !== null && stored < scenarios.length ? stored : scenarios.length - 1;
    setFromLive(false); await analyze(scenarios[idx].z, scenarios[idx].name);
  }

  useEffect(() => {
    (async () => {
      const a = analysisStore.get();
      if (a.z) { setFromLive(true); await analyze(a.z, a.name); }   // 라이브에서 보낸 샷 우선
      else await loadScenario();
      try { setPca(await api.pca()); } catch { /* PCA optional */ }
      try { setCausal(await api.causal()); } catch { /* causal optional */ }
    })();
    // 라이브에서 새 샷을 보내면(탭에 머무는 동안) 갱신
    return analysisStore.subscribe(() => {
      const a = analysisStore.get();
      if (a.z) { setFromLive(true); analyze(a.z, a.name); }
    });
  }, []);

  function backToScenario() { analysisStore.clear(); loadScenario(); }

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
    // 축 박스(x:48~440, y:14~190) 안쪽으로 마커 반경만큼 들여서 매핑 (밖으로 안 튀게)
    const sx = (v: number) => 54 + ((cl(v, xmin, xmax) - xmin) / (xmax - xmin + 1e-9)) * 380;
    const sy = (v: number) => 184 - ((cl(v, ymin, ymax) - ymin) / (ymax - ymin + 1e-9)) * 164;
    const step = Math.ceil(pca.normal_pc1.length / 320);
    const normal: [number, number][] = [];
    for (let i = 0; i < pca.normal_pc1.length; i += step) normal.push([sx(pca.normal_pc1[i]), sy(pca.normal_pc2[i])]);
    const defect: [number, number][] = pca.defect_pc1.map((v: number, i: number) => [sx(v), sy(pca.defect_pc2[i])]);
    // 축 의미 = 각 주성분의 최대 기여 센서 (실측 loadings)
    const topSensor = (pc: number) => {
      if (!pca.pca_components?.[pc]) return "";
      const cols = pca.sensor_cols as string[];
      let mi = 0, mv = 0; pca.pca_components[pc].forEach((w: number, i: number) => { if (Math.abs(w) > mv) { mv = Math.abs(w); mi = i; } });
      return ko(cols[mi]);
    };
    return { normal, defect, ev: pca.explained_var, ax1: topSensor(0), ax2: topSensor(1) };
  })();

  const maxAbs = top.length ? Math.max(...top.map(t => t.abs_shap)) : 1;
  // 워터폴: 진짜 SHAP 기준값 E[f(X)](배경 평균 복원오차)에서 top-5 + 기타 누적 → 예측
  const base = wf?.base ?? 0;
  const pred = wf?.pred ?? recon ?? 0;
  // 막대 시퀀스: top-5 SHAP + "기타 N센서"(나머지 순기여)
  const wfBars = wf
    ? [...top.map((t) => ({ name: t.name, label: t.name, shap: t.shap, sigma: t.sigma })),
       { name: "__rest__", label: `기타 ${wf.rest_n}센서`, shap: wf.rest, sigma: "" }]
    : top.map((t) => ({ name: t.name, label: t.name, shap: t.shap, sigma: t.sigma }));

  return (
    <DashShell activeTab={2} scenario={scName}
      headline="불량 원인 분석 · GradientSHAP + 인과 그래프"
      sub={`${scName} · GradientExplainer < 100 ms${err ? " · ⚠ 백엔드 미연결" : ""}`}>

      {fromLive && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", background: "var(--sx-cyan-bg)", border: "1px solid var(--sx-cyan-bd)" }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--sx-cyan)" }}>📡 라이브 샷 분석 중 · {scName} — 실시간 진단에서 보낸 실제 샷</span>
          <button onClick={backToScenario} className="btn subtle" style={{ padding: "3px 12px", fontSize: 10.5, fontWeight: 700 }}>데모 시나리오로 돌아가기</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flex: 1, minHeight: 0 }}>
        <div className="card">
          <div className="h"><span className="ttl">▶ TOP-5 이상 원인 센서 · 이상 기여 {cum !== null ? Math.round(cum * 100) : "—"}%</span><span className="sub">양의 SHAP(복원오차↑) 큰 순 · GradientSHAP</span></div>
          <div className="b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {top.map((s, i) => (
              <div key={s.name}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  <span style={{ color: "var(--sx-red-soft)" }}>#{(i + 1).toString().padStart(2, "0")} {ko(s.name)}</span>
                  <span className="num" style={{ color: "var(--sx-text-3)" }}>SHAP {s.shap.toFixed(3)} · {s.sigma}</span>
                </div>
                <div className="bar" style={{ height: 12 }}>
                  <i className="red" style={{ width: (s.abs_shap / maxAbs * 100) + "%" }}></i>
                </div>
              </div>
            ))}
            {!top.length && <div style={{ fontSize: 11, color: "var(--sx-text-3)" }}>SHAP 계산 중…</div>}
            <div style={{ fontSize: 10, color: "var(--sx-text-4)", fontWeight: 700, letterSpacing: 0.4, marginTop: 6 }}>+ 나머지 19센서 = 워터폴 &apos;기타&apos;</div>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">SHAP Waterfall · 누적 분해</span><span className="sub">{recon !== null ? `기준 ${base.toFixed(3)} → 예측 ${pred.toFixed(3)} (복원오차)` : "계산 중"}</span></div>
          <div className="b">
            <svg viewBox="0 0 460 250" style={{ width: "100%", height: 250, display: "block" }}>
              {(() => {
                if (!wfBars.length || recon === null) return null;
                // 누적 궤적: 기준 E[f(X)] → +SHAP … → +기타 → 예측. 실제 min/max로 스케일.
                const acc: number[] = [base]; let a = base;
                wfBars.forEach((s) => { a += s.shap; acc.push(a); });
                const lo = Math.min(...acc, pred), hi = Math.max(...acc, base, pred);
                const pad = (hi - lo) * 0.2 || 0.05;
                const y0 = lo - pad, y1 = hi + pad;
                const TOP = 44, BOT = 188;
                const yOf = (v: number) => BOT - ((v - y0) / (y1 - y0)) * (BOT - TOP);
                const n = wfBars.length, x0 = 40, step = 404 / n, bw = Math.min(50, step * 0.62);
                return (<>
                  <line x1="24" y1={BOT} x2="444" y2={BOT} stroke="var(--sx-border-2)" strokeWidth="0.8" />
                  <line x1="24" y1={yOf(base)} x2="444" y2={yOf(base)} stroke="var(--sx-text-4)" strokeWidth="0.6" strokeDasharray="3 3" opacity="0.6" />
                  <text x="24" y={yOf(base) - 4} fill="var(--sx-text-3)" fontSize="8.5" fontWeight="700">기준 {base.toFixed(3)}</text>
                  {wfBars.map((s, i) => {
                    const before = acc[i], after = acc[i + 1];
                    const x = x0 + i * step + (step - bw) / 2;
                    const yTop = yOf(Math.max(before, after));
                    const yBot = yOf(Math.min(before, after));
                    const pos = s.shap >= 0;
                    const isRest = s.name === "__rest__";
                    const fill = isRest ? "var(--sx-text-3)" : (pos ? "var(--sx-red)" : "var(--sx-cyan)");
                    const labelAbove = yTop > TOP + 14;
                    const nm = isRest ? s.label : (ko(s.name).length > 6 ? ko(s.name).slice(0, 6) : ko(s.name));
                    return (
                      <g key={s.name}>
                        <rect x={x} y={yTop} width={bw} height={Math.max(2, yBot - yTop)} fill={fill} fillOpacity={isRest ? 0.5 : 0.8} />
                        {i < n - 1 && <line x1={x + bw} y1={yOf(after)} x2={x0 + (i + 1) * step + (step - bw) / 2} y2={yOf(after)} stroke="var(--sx-border-2)" strokeWidth="0.8" strokeDasharray="2 2" />}
                        <text x={x + bw / 2} y={labelAbove ? yTop - 4 : yBot + 11} fill={isRest ? "var(--sx-text-3)" : (pos ? "var(--sx-red-soft)" : "var(--sx-cyan)")} fontSize="8.5" fontWeight="800" textAnchor="middle" fontFamily="ui-monospace">{pos ? "+" : ""}{s.shap.toFixed(3)}</text>
                        <text x={x + bw / 2} y={BOT + 13} fill="var(--sx-text-3)" fontSize="7.5" fontWeight="700" textAnchor="middle">{nm}</text>
                        {!isRest && <text x={x + bw / 2} y={BOT + 23} fill="var(--sx-text-4)" fontSize="7.5" fontWeight="700" textAnchor="middle">{s.sigma}</text>}
                      </g>
                    );
                  })}
                  <circle cx={x0 + (n - 1) * step + (step - bw) / 2 + bw} cy={yOf(pred)} r="3.5" fill="var(--sx-red)" />
                  <text x={x0 + (n - 1) * step + (step - bw) / 2 + bw + 4} y={yOf(pred) - 7} fill="var(--sx-red-soft)" fontSize="9" fontWeight="800" textAnchor="end">예측 {pred.toFixed(3)}</text>
                </>);
              })()}
              {(!wfBars.length || recon === null) && <text x="230" y="120" fill="var(--sx-text-3)" fontSize="11" textAnchor="middle">계산 중…</text>}
            </svg>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">인과 의존성 그래프 · {graph ? ko(graph.effect) : "—"} 연결</span><span className="sub">{graph ? "|r|≥0.4 · 사이클 시간순서" : "로딩"}</span></div>
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
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">PCA 클러스터 · 정상 vs 이상</span><span className="sub">24센서 → 2축 압축 · 분산 {pcaPts ? ((pcaPts.ev[0] + pcaPts.ev[1]) * 100).toFixed(0) : "—"}% 보존</span></div>
          <div className="b">
            <svg viewBox="0 0 460 214" style={{ width: "100%", height: 200, display: "block" }}>
              <line x1="48" y1="190" x2="440" y2="190" stroke="var(--sx-border-2)" strokeWidth="0.6" />
              <line x1="48" y1="14" x2="48" y2="190" stroke="var(--sx-border-2)" strokeWidth="0.6" />
              {pcaPts?.normal.map((p, i) => (
                <circle key={"n" + i} cx={p[0]} cy={p[1]} r="1.4" fill="#C8C8CD" opacity="0.4" />
              ))}
              {pcaPts?.defect.map((p, i) => (
                <circle key={"a" + i} cx={p[0]} cy={p[1]} r="3" fill="#D42121" opacity="0.9" stroke="#fff" strokeWidth="0.4" />
              ))}
              <text x="440" y="206" fill="var(--sx-text-3)" fontSize="8.5" fontWeight="700" textAnchor="end">PC1 · {pcaPts?.ax1 || "주성분1"} 중심 {pcaPts ? (pcaPts.ev[0] * 100).toFixed(0) : "—"}% →</text>
              <text x="12" y="102" fill="var(--sx-text-3)" fontSize="8.5" fontWeight="700" textAnchor="middle" transform="rotate(-90 12 102)">PC2 · {pcaPts?.ax2 || "주성분2"} 중심 {pcaPts ? (pcaPts.ev[1] * 100).toFixed(0) : "—"}% →</text>
              {!pcaPts && <text x="244" y="100" fill="var(--sx-text-3)" fontSize="10" fontWeight="700" textAnchor="middle">PCA 로딩 중…</text>}
            </svg>
            <div style={{ display: "flex", gap: 16, fontSize: 10, fontWeight: 700, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ color: "var(--sx-text-2)" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#C8C8CD", marginRight: 5 }}></span>정상 n={pca?.n_normal ?? "—"}</span>
              <span style={{ color: "var(--sx-red-soft)" }}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "#D42121", marginRight: 5 }}></span>이상(불량) n={pca?.n_defect ?? "—"}</span>
              <span style={{ color: "var(--sx-text-4)", fontWeight: 600 }}>PC1·PC2 직교(상관 0)라 추세가 아닌 분포로 봄 · 불량은 평균 5σ 바깥이나 일부는 정상과 겹침(완벽 분리는 24D 복원오차)</span>
            </div>
          </div>
        </div>
      </div>
    </DashShell>
  );
}
