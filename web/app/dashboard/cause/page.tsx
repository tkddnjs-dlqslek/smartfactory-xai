"use client";
/* SmartFactory XAI — Tab 2 불량 원인 분석 (DashTab2)
   원본: _design_package/smart-factory-mvp/project/design-dashboard.jsx :215-355
   디자인 1:1 매칭 — mock 데이터로 우선 구동 (백엔드 연동은 다음 단계) */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api, scenarioStore, ShapTop } from "@/lib/api";

export default function CausePage() {
  const [top, setTop] = useState<ShapTop[]>([]);
  const [cum, setCum] = useState<number | null>(null);
  const [recon, setRecon] = useState<number | null>(null);
  const [scName, setScName] = useState("긴급 #37");
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
    })();
  }, []);

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
          <div className="h"><span className="ttl">▶ TOP-5 SHAP 막대 · {cum !== null ? Math.round(cum * 100) : "—"}% 누적</span><span className="sub">GradientSHAP nsamples=50 <span className="tag real" style={{ marginLeft: 4 }}>실측</span></span></div>
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
          <div className="h"><span className="ttl">SHAP Waterfall · 누적 분해</span><span className="sub">{recon !== null ? `기준 ${base.toFixed(3)} → 예측 ${pred.toFixed(3)}` : "계산 중"} <span className="tag real" style={{ marginLeft: 4 }}>실측</span></span></div>
          <div className="b">
            <svg viewBox="0 0 460 240" style={{ width: "100%", height: 240, display: "block" }}>
              <line x1="20" y1="210" x2="440" y2="210" stroke="var(--sx-border-2)" strokeWidth="0.8" />
              <text x="20" y="224" fill="var(--sx-text-3)" fontSize="9" fontWeight="700">기준 {recon !== null ? base.toFixed(3) : "—"}</text>
              <text x="440" y="224" fill="var(--sx-red-soft)" fontSize="9" fontWeight="700" textAnchor="end">예측 {recon !== null ? pred.toFixed(3) : "—"}</text>
              {(() => {
                if (!top.length || recon === null) return null;
                const span = Math.max(pred - base, 1e-6);
                const yOf = (v: number) => 200 - ((v - base) / span) * 170;
                let acc = base;
                const bw = 56;
                return top.map((s, i) => {
                  const before = acc; const after = acc + s.shap; acc = after;
                  const x = 44 + i * 78;
                  const yTop = yOf(Math.max(before, after));
                  const yBot = yOf(Math.min(before, after));
                  const pos = s.shap >= 0;
                  return (
                    <g key={s.name}>
                      <rect x={x} y={yTop} width={bw} height={Math.max(2, yBot - yTop)} fill={pos ? "var(--sx-red)" : "var(--sx-cyan)"} fillOpacity="0.78" />
                      {i < top.length - 1 && <line x1={x + bw} y1={yOf(after)} x2={x + bw + 22} y2={yOf(after)} stroke="var(--sx-border-2)" strokeDasharray="2 2" />}
                      <text x={x + bw / 2} y={yTop - 5} fill={pos ? "var(--sx-red-soft)" : "var(--sx-cyan)"} fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="ui-monospace">{pos ? "+" : ""}{s.shap.toFixed(3)}</text>
                      <text x={x + bw / 2} y={226} fill="var(--sx-text-3)" fontSize="8" fontWeight="700" textAnchor="middle">{s.name.replace(/_/g, " ").slice(0, 9)}</text>
                    </g>
                  );
                });
              })()}
            </svg>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">24센서 인과 그래프</span><span className="sub">Bootstrap 200 · 95% CI 통과 엣지만</span></div>
          <div className="b" style={{ padding: 14 }}>
            <svg viewBox="0 0 460 280" style={{ width: "100%", height: 280, display: "block" }}>
              <defs>
                <marker id="ca" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 Z" fill="#D42121" />
                </marker>
              </defs>
              {[
                { x: 30, y: 46, n: "Nozzle_Temp", v: "+4.8σ" },
                { x: 30, y: 130, n: "Hot_Runner", v: "+2.4σ" },
                { x: 30, y: 214, n: "Cushion_Pos", v: "+3.6σ" },
              ].map((c) => (
                <g key={c.n}>
                  <rect x={c.x} y={c.y} width="120" height="44" fill="#D421211F" stroke="#D42121" strokeWidth="1" />
                  <text x={c.x + 10} y={c.y + 18} fill="#FF5A4A" fontSize="11" fontWeight="800">{c.n}</text>
                  <text x={c.x + 10} y={c.y + 34} fill="#5A5A60" fontSize="9" fontWeight="700">{c.v}</text>
                </g>
              ))}
              <rect x="200" y="110" width="100" height="60" fill="#141417" stroke="#00D4FF" strokeWidth="1.4" />
              <text x="250" y="132" fill="#F5F5F5" fontSize="11" fontWeight="800" textAnchor="middle">수지 점도</text>
              <text x="250" y="148" fill="#F5F5F5" fontSize="11" fontWeight="800" textAnchor="middle">저하</text>
              <text x="250" y="164" fill="#84848B" fontSize="8" fontWeight="700" textAnchor="middle">(mediator)</text>
              <rect x="350" y="116" width="100" height="48" fill="#D42121" stroke="#D42121" />
              <text x="400" y="138" fill="#fff" fontSize="12" fontWeight="800" textAnchor="middle">Filling_Time</text>
              <text x="400" y="155" fill="rgba(255,255,255,0.8)" fontSize="9" fontWeight="700" textAnchor="middle">+4.2σ (effect)</text>
              <path d="M 150 68  Q 180 100, 200 130" stroke="#D42121" strokeWidth="1.6" fill="none" markerEnd="url(#ca)" opacity="0.85" />
              <path d="M 150 152 Q 180 145, 200 140" stroke="#D42121" strokeWidth="1.8" fill="none" markerEnd="url(#ca)" opacity="0.9" />
              <path d="M 150 236 Q 180 200, 200 162" stroke="#D42121" strokeWidth="1.2" fill="none" markerEnd="url(#ca)" opacity="0.6" />
              <path d="M 300 140 L 350 140" stroke="#D42121" strokeWidth="2.0" fill="none" markerEnd="url(#ca)" />
              <text x="170" y="100" fill="#FF5A4A" fontSize="9" fontWeight="800">w=0.74</text>
              <text x="170" y="138" fill="#FF5A4A" fontSize="9" fontWeight="800">w=0.81</text>
              <text x="170" y="216" fill="#FF5A4A" fontSize="9" fontWeight="800">w=0.52</text>
              <text x="320" y="134" fill="#FF5A4A" fontSize="9" fontWeight="800">w=0.91</text>
              <text x="30" y="20" fill="var(--sx-text-3)" fontSize="9" fontWeight="700">CAUSE</text>
              <text x="200" y="100" fill="var(--sx-text-3)" fontSize="9" fontWeight="700">MEDIATOR</text>
              <text x="350" y="108" fill="var(--sx-text-3)" fontSize="9" fontWeight="700">EFFECT</text>
            </svg>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">PCA 클러스터 · 정상 vs 이상</span><span className="sub">현재 샷 표시</span></div>
          <div className="b">
            <svg viewBox="0 0 460 220" style={{ width: "100%", height: 220, display: "block" }}>
              <line x1="20" y1="200" x2="440" y2="200" stroke="var(--sx-border)" strokeWidth="0.5" />
              <line x1="20" y1="10" x2="20" y2="200" stroke="var(--sx-border)" strokeWidth="0.5" />
              {NORMAL_PTS.map((p, i) => (
                <circle key={"n" + i} cx={p.x} cy={p.y} r="1.4" fill="#C8C8CD" opacity="0.5" />
              ))}
              {ANOM_PTS.map((p, i) => (
                <circle key={"a" + i} cx={p.x} cy={p.y} r="2" fill="#D42121" opacity="0.85" />
              ))}
              <circle cx="378" cy="68" r="6" fill="none" stroke="#fff" strokeWidth="1.4" />
              <line x1="378" y1="62" x2="378" y2="36" stroke="#fff" strokeWidth="0.7" strokeDasharray="2 2" />
              <text x="378" y="32" fill="#fff" fontSize="9" fontWeight="800" textAnchor="middle">#1,248</text>
              <text x="100" y="26" fill="#C8C8CD" fontSize="10" fontWeight="700">정상 cluster · n=1,340</text>
              <text x="330" y="180" fill="#FF5A4A" fontSize="10" fontWeight="700">이상 cluster · n=39</text>
            </svg>
          </div>
        </div>
      </div>
    </DashShell>
  );
}

/* PCA 산점도 — SSR/CSR 하이드레이션 불일치 방지를 위해 고정 시드 좌표 사용 */
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const _r = mulberry32(1248);
const NORMAL_PTS = Array.from({ length: 180 }, () => ({
  x: 140 + (_r() - 0.5) * 130,
  y: 100 + (_r() - 0.5) * 80,
}));
const ANOM_PTS = Array.from({ length: 28 }, () => ({
  x: 360 + (_r() - 0.5) * 70,
  y: 60 + (_r() - 0.5) * 60,
}));
