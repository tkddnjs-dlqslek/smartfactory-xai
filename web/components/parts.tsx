"use client";
/* SmartFactory XAI — shared chart and shell parts (mission-control aesthetic)
   원본: _design_package/smart-factory-mvp/project/design-parts.jsx */
import React from "react";
import Link from "next/link";

/* ───── 5탭 → 라우트 매핑 ───── */
export const TAB_ROUTES: Record<number, string> = {
  1: "/dashboard",
  2: "/dashboard/cause",
  3: "/dashboard/batch",
  4: "/dashboard/history",
  5: "/dashboard/safety",
  6: "/dashboard/production",
  7: "/dashboard/trust",
};

/* ───── 4-AI Consensus Meter ───── */
export function Consensus({ votes = [1,1,1,0], scores = [0.412, 0.622, 0.511, 1.18], soft = 0.957, dense = false }: any) {
  const models = [
    { id: "AE",    auc: 0.9254 },
    { id: "IF",    auc: 0.9571 },
    { id: "OCSVM", auc: 0.9600 },
    { id: "LOF",   auc: 0.9312 },
  ];
  const agree = votes.filter((v: number) => v).length;
  return (
    <div>
      <div className="consensus">
        {models.map((m, i) => (
          <div key={m.id} className={"m" + (votes[i] ? " fire" : "")}>
            <div className="id">{m.id}</div>
            <div className="v" style={{color: votes[i] ? "var(--sx-red-soft)" : "var(--sx-text)"}}>
              {scores[i].toFixed(3)}
            </div>
            <div className="auc">AUC {m.auc.toFixed(4)}</div>
            <div style={{
              marginTop:6, fontSize:9, fontWeight:800, letterSpacing:0.6,
              color: votes[i] ? "var(--sx-red-soft)" : "var(--sx-text-3)"
            }}>{votes[i] ? "▲ FIRE" : "● HOLD"}</div>
          </div>
        ))}
      </div>
      {!dense && (
        <div style={{marginTop:10}}>
          <div style={{display:"flex", justifyContent:"space-between", fontSize:9.5, fontWeight:700, color:"var(--sx-text-3)", letterSpacing:0.6, textTransform:"uppercase", marginBottom:5}}>
            <span>AUC-가중 SOFT VOTING</span>
            <span className="num" style={{color:"var(--sx-red-soft)"}}>{soft.toFixed(4)} <span className="tag real" style={{marginLeft:4}}>실측</span></span>
          </div>
          <div className="bar" style={{height:10}}>
            <i className="red" style={{width:`${Math.min(100, soft*100)}%`}}></i>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", fontSize:9, color:"var(--sx-text-4)", fontWeight:600, marginTop:4}}>
            <span>0.00</span>
            <span>합의 임계 0.5</span>
            <span>1.00</span>
          </div>
          <div style={{marginTop:8, display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--sx-text-3)", fontWeight:700}}>
            <span>합의 모드: <span style={{color:"var(--sx-red-soft)"}}>≥3/4 엄격</span> · 동의 {agree}/4</span>
            <span>판정: <span style={{color: agree>=3 ? "var(--sx-red-soft)" : "var(--sx-text-2)"}}>{agree>=3 ? "▲ DEFECT" : "● NORMAL"}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── semicircle gauge ───── */
export function Gauge({ value = 0.412, threshold = 0.184, label = "RECON ERROR", state = "danger" }: any) {
  const max = 0.6;
  const v = Math.min(1, value / max);
  const t = threshold / max;
  const angle = 180 - v * 180;
  const tAngle = 180 - t * 180;
  const cx = 110, cy = 100, r = 78;
  const rad = (a: number) => (a * Math.PI) / 180;
  const nx = cx + r * Math.cos(rad(angle));
  const ny = cy - r * Math.sin(rad(angle));
  const tx1 = cx + (r - 12) * Math.cos(rad(tAngle));
  const ty1 = cy - (r - 12) * Math.sin(rad(tAngle));
  const tx2 = cx + (r + 6)  * Math.cos(rad(tAngle));
  const ty2 = cy - (r + 6)  * Math.sin(rad(tAngle));
  const arc = (a1: number, a2: number) => {
    const p1 = { x: cx + r*Math.cos(rad(a1)), y: cy - r*Math.sin(rad(a1)) };
    const p2 = { x: cx + r*Math.cos(rad(a2)), y: cy - r*Math.sin(rad(a2)) };
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
  };
  const col = state === "danger" ? "var(--sx-red)" : state === "warn" ? "var(--sx-cyan)" : "var(--sx-text-2)";
  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", alignItems:"center", width:"100%", height:140}}>
      <div style={{gridColumn:"1", height:"100%", minWidth:0}}>
        <svg viewBox="0 0 220 130" preserveAspectRatio="xMidYMid meet" style={{width:"100%", height:"100%", display:"block"}}>
          {Array.from({length: 13}, (_, i) => {
            const a = 180 - (i/12)*180;
            const x1 = cx + (r + 4) * Math.cos(rad(a));
            const y1 = cy - (r + 4) * Math.sin(rad(a));
            const x2 = cx + (r + (i%3 === 0 ? 10 : 7)) * Math.cos(rad(a));
            const y2 = cy - (r + (i%3 === 0 ? 10 : 7)) * Math.sin(rad(a));
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i%3===0 ? "var(--sx-text-3)" : "var(--sx-border-2)"} strokeWidth="0.8"/>;
          })}
          <path d={arc(180, tAngle)} stroke="var(--sx-border-2)" strokeWidth="14" fill="none"/>
          <path d={arc(tAngle, 0)} stroke="var(--sx-red-bd)" strokeWidth="14" fill="none"/>
          <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="var(--sx-red)" strokeWidth="1.5"/>
          <text x={tx2 + 2} y={ty2 - 2} fill="var(--sx-red-soft)" fontSize="8" fontWeight="700">τ {threshold.toFixed(3)}</text>
          <text x="20" y="120" fill="var(--sx-text-4)" fontSize="8.5" fontWeight="700">0.00</text>
          <text x="190" y="120" fill="var(--sx-text-4)" fontSize="8.5" fontWeight="700" textAnchor="end">{max.toFixed(2)}</text>
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={col} strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx={cx} cy={cy} r="6" fill={col}/>
          <circle cx={cx} cy={cy} r="2.5" fill="var(--sx-bg)"/>
        </svg>
      </div>
      <div style={{flex:"0 0 auto", textAlign:"right", paddingRight:4, minWidth:84}}>
        <div className="eyebrow">{label}</div>
        <div className="num" style={{fontSize:26, fontWeight:800, color:col, lineHeight:1, marginTop:4}}>{value.toFixed(3)}</div>
      </div>
    </div>
  );
}

/* ───── sparkline ───── */
export function Spark({ data, threshold, height = 60, color, alertIdx = null }: any) {
  const w = 100, h = height;
  const max = Math.max(...data, threshold * 1.5);
  const points = data.map((v: number, i: number) => `${i === 0 ? "M" : "L"} ${(i/(data.length-1))*w} ${h - (v/max)*(h-4) - 2}`).join(" ");
  const tY = h - (threshold/max)*(h-4) - 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{width:"100%", height:"100%", display:"block"}}>
      <line x1="0" y1={tY} x2={w} y2={tY} stroke="var(--sx-red)" strokeWidth="0.4" strokeDasharray="1.5 1.5"/>
      <path d={points} fill="none" stroke={color || "var(--sx-cyan)"} strokeWidth="0.7"/>
      {data.map((v: number, i: number) => v > threshold ? (
        <circle key={i} cx={(i/(data.length-1))*w} cy={h - (v/max)*(h-4) - 2} r="1.2" fill="var(--sx-red)"/>
      ) : null)}
      {alertIdx !== null && (
        <line x1={(alertIdx/(data.length-1))*w} y1="0" x2={(alertIdx/(data.length-1))*w} y2={h} stroke="var(--sx-red)" strokeWidth="0.5" strokeDasharray="2 1.5"/>
      )}
    </svg>
  );
}

/* ───── helper ───── */
export function makeSeries(len = 60, spikeIdx = -1, spikeMag = 0.45, base = 0.07, noise = 0.022) {
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    let v = base + Math.sin(i*0.35)*noise + (Math.random()-0.5)*noise;
    if (i === spikeIdx) v = spikeMag;
    if (i === spikeIdx + 1) v = spikeMag * 0.78;
    if (i === spikeIdx + 2) v = spikeMag * 0.42;
    out.push(Math.max(0, v));
  }
  return out;
}

/* ───── annotated number ───── */
export function Annot({ value, unit, tag = "real", size = 14, color }: any) {
  return (
    <span style={{display:"inline-flex", alignItems:"baseline", gap:5}}>
      <span className="num" style={{fontSize: size, fontWeight: 800, color: color || "var(--sx-text)"}}>{value}{unit ? <span style={{fontSize: size*0.55, color:"var(--sx-text-3)", marginLeft:2}}>{unit}</span> : null}</span>
      <span className={"tag " + tag}>{tag === "real" ? "실측" : tag === "est" ? "추정치" : "가정"}</span>
    </span>
  );
}

/* ───── topbar for dashboard ───── */
export function TopBar({ width = 1440 }: any) {
  return (
    <div style={{
      height: 56, padding: "0 24px", background: "var(--sx-bg-2)",
      borderBottom: "1px solid var(--sx-border)",
      display: "flex", alignItems: "center", gap: 14
    }}>
      <div style={{display:"flex", alignItems:"center", gap:10}}>
        <div style={{width:22, height:22, position:"relative", display:"grid", gridTemplateColumns:"1fr 1fr", gap:1.5}}>
          <span style={{background:"var(--sx-cyan)"}}></span>
          <span style={{background:"var(--sx-red)"}}></span>
          <span style={{background:"var(--sx-text-3)"}}></span>
          <span style={{background:"var(--sx-text-3)"}}></span>
        </div>
        <div>
          <div style={{fontSize:13, fontWeight:800, letterSpacing:0.3}}>SmartFactory XAI</div>
          <div style={{fontSize:9, color:"var(--sx-text-3)", fontWeight:700, letterSpacing:0.6, textTransform:"uppercase"}}>통합 운영 플랫폼 · 품질·설비·안전·생산</div>
        </div>
      </div>
      <div style={{width:28, height:28, marginLeft:"auto", borderRadius:0, border:"1px solid var(--sx-border-2)", display:"grid", placeItems:"center", fontSize:11, fontWeight:800, color:"var(--sx-text-2)"}}>김</div>
    </div>
  );
}

/* ───── sidebar 280 ───── */
export function Sidebar({ active = 1, scenario = "정상", width = 280 }: any) {
  const pillars = [
    { p: "품질 관리 / Quality", c: "var(--sx-red-soft)", tabs: [
      { i: 1, t: "실시간 진단",     sub: "Real-time" },
      { i: 2, t: "불량 원인 분석",   sub: "SHAP" },
      { i: 3, t: "전체 이력 분석",   sub: "Batch" },
    ]},
    { p: "설비 관리 / Equipment", c: "var(--sx-cyan)", tabs: [
      { i: 4, t: "설비 예지정비 · RUL", sub: "Predictive" },
    ]},
    { p: "안전 관리 / Safety", c: "#FFA756", tabs: [
      { i: 5, t: "안전 위험 모니터링", sub: "Safety" },
    ]},
    { p: "생산 관리 / Production", c: "#4CAF50", tabs: [
      { i: 6, t: "생산 현황 · OEE",   sub: "Production" },
    ]},
    { p: "AI 신뢰도 / Trust", c: "var(--sx-text-3)", tabs: [
      { i: 7, t: "모델 신뢰도 확인",   sub: "Model trust" },
    ]},
  ];
  return (
    <div style={{
      width, background:"var(--sx-bg-2)",
      borderRight:"1px solid var(--sx-border)",
      display:"flex", flexDirection:"column", flexShrink:0
    }}>
      <div style={{padding:"16px 18px 12px"}}>
        <div className="eyebrow">통합 운영 플랫폼 / Platform</div>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:6}}>
          <div style={{fontSize:14, fontWeight:800}}>IM-7 사출성형 라인</div>
          <span className="tag cyan">활성</span>
        </div>
        <div style={{fontSize:10, color:"var(--sx-text-3)", fontWeight:600, marginTop:3}}>품질·설비·안전·생산 통합 · KAMP 1,379 shots <span className="tag real" style={{marginLeft:4}}>실측</span></div>
      </div>

      <div className="hair"></div>
      <div style={{padding:"10px 0"}}>
        {pillars.map(pl => (
          <div key={pl.p} style={{marginBottom:6}}>
            <div className="eyebrow" style={{padding:"6px 18px 4px", color:pl.c}}>{pl.p}</div>
            {pl.tabs.map(t => (
              <Link key={t.i} href={TAB_ROUTES[t.i]} className={"sidebar-row" + (t.i === active ? " active" : "")} style={{textDecoration:"none", color:"inherit"}}>
                <span className="n mono">{t.i.toString().padStart(2,"0")}</span>
                <div style={{display:"flex", flexDirection:"column", gap:1}}>
                  <span>{t.t}</span>
                  <span style={{fontSize:9, color:"var(--sx-text-4)", letterSpacing:0.5, textTransform:"uppercase", fontWeight:700}}>{t.sub}</span>
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="hair"></div>
      <div style={{padding:"14px 18px"}}>
        <div className="eyebrow" style={{marginBottom:8}}>24h 누적 KPI</div>
        {[
          { l:"감지 이상",   v:"42",  c:"var(--sx-red-soft)", r:"실측" },
          { l:"처방 채택",   v:"87%", c:"var(--sx-cyan)",     r:"실측" },
          { l:"평균 복구",   v:"4:48",c:"var(--sx-text)",     r:"실측" },
          { l:"라인 정지",   v:"00:00",c:"var(--sx-cyan)",    r:"실측" },
        ].map(k => (
          <div key={k.l} style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", padding:"4px 0", fontSize:10.5}}>
            <span style={{color:"var(--sx-text-3)", fontWeight:700, letterSpacing:0.4}}>{k.l}</span>
            <span><span className="num" style={{color:k.c, fontWeight:800}}>{k.v}</span><span className="tag real" style={{marginLeft:4, fontSize:8, padding:"1px 3px"}}>{k.r}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───── tab bar ───── */
export function TabBar({ active = 1 }: any) {
  const tabs = [
    { i:1, l:"실시간 진단" },
    { i:2, l:"불량 원인 분석" },
    { i:3, l:"전체 이력 분석" },
    { i:4, l:"설비 예지정비" },
    { i:5, l:"안전 모니터링" },
    { i:6, l:"생산 · OEE" },
    { i:7, l:"모델 신뢰도" },
  ];
  return (
    <div className="tabs">
      {tabs.map(t => (
        <Link key={t.i} href={TAB_ROUTES[t.i]} className={"t" + (t.i === active ? " active" : "")} style={{textDecoration:"none", color:"inherit"}}>
          <span className="n mono">{t.i.toString().padStart(2,"0")}</span>
          <span>{t.l}</span>
        </Link>
      ))}
    </div>
  );
}

/* ───── dashboard shell (TopBar + Sidebar + TabBar + 헤더) ───── */
export function DashShell({ activeTab, scenario = "정상", children, headline, sub }: any) {
  return (
    <div className="sx" style={{ width: "100%", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar active={activeTab} scenario={scenario} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "18px 24px 24px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            {(headline || sub) && (
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 }}>
                <div>
                  <div className="eyebrow">TAB {activeTab.toString().padStart(2, "0")}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, marginTop: 6 }}>{headline}</div>
                  {sub && <div style={{ fontSize: 11, color: "var(--sx-text-3)", fontWeight: 600, marginTop: 4 }}>{sub}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span className="tag real">실측</span>
                  <span className="tag">95% CI Bootstrap n=1000</span>
                </div>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───── 24-sensor slider list (compact, 5 groups) ───── */
export const S24: any[] = [
  { g:"시간 / TIME",  rows:[
    ["Cycle_Time",   0.42, 0.3, false],
    ["Filling_Time", 0.85, 4.2, true],
    ["Plast_Time",   0.51, 0.5, false],
    ["Cool_Time",    0.34, -0.1, false],
    ["Inject_Time",  0.48, 0.45, false],
  ]},
  { g:"위치 / POS",   rows:[
    ["Switch_Over",  0.38, 0.4, false],
    ["Cushion_Pos",  0.91, 3.6, true],
    ["End_Position", 0.55, 0.55, false],
  ]},
  { g:"속도 / RPM",   rows:[
    ["Screw_RPM",    0.62, 0.6, false],
    ["Inject_Speed", 0.74, 0.7, false],
    ["Eject_Speed",  0.41, 0.4, false],
  ]},
  { g:"압력 / PRESS", rows:[
    ["Hold_Pressure",  0.78, 0.75, false],
    ["Inject_Press",   0.83, 0.85, false],
    ["Back_Pressure",  0.45, 0.45, false],
    ["Peak_Pressure",  0.88, 3.1, true],
    ["Clamp_Force",    0.51, 0.5, false],
  ]},
  { g:"온도 / TEMP",  rows:[
    ["Nozzle_Temp", 0.94, 4.8, true],
    ["Barrel_T1",   0.61, 0.6, false],
    ["Barrel_T2",   0.55, 0.55, false],
    ["Barrel_T3",   0.47, 0.45, false],
    ["Mold_Temp_A", 0.72, 1.3, false],
    ["Mold_Temp_B", 0.66, 1.0, false],
    ["Hot_Runner",  0.81, 2.4, true],
    ["Oil_Temp",    0.39, 0.4, false],
  ]},
];

export function SensorGrid({ groups }: any = {}) {
  // 실제 백엔드 데이터(groups)가 오면 그대로, 없으면 mock S24
  if (groups && groups.length) {
    return (
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", columnGap:24, rowGap:6}}>
        {groups.map((g: any) => (
          <div key={g.group} style={{gridColumn: g.group.startsWith("온도") ? "3 / span 1" : "auto"}}>
            <div className="eyebrow" style={{marginBottom:4, color:"var(--sx-text-3)"}}>{g.group} · {g.rows.length}</div>
            {g.rows.map((r: any) => (
              <div className="sensor" key={r.name}>
                <span className={"nm" + (r.hot ? " hot" : "")}>{r.name}</span>
                <span className={"sig" + (r.hot ? " hot" : "")}>{r.sigma > 0 ? "+" : ""}{r.sigma.toFixed(1)}σ</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", columnGap:24, rowGap:6}}>
      {S24.map(g => (
        <div key={g.g} style={{gridColumn: g.g.startsWith("온도") ? "3 / span 1" : "auto"}}>
          <div className="eyebrow" style={{marginBottom:4, color:"var(--sx-text-3)"}}>{g.g} · {g.rows.length}</div>
          {g.rows.map((r: any) => (
            <div className="sensor" key={r[0]}>
              <span className={"nm" + (r[3] ? " hot" : "")}>{r[0]}</span>
              <span className={"sig" + (r[3] ? " hot" : "")}>{r[2] > 0 ? "+" : ""}{r[2].toFixed(1)}σ</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
