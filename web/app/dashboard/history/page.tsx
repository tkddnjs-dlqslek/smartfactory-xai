"use client";
/* SmartFactory XAI — Tab 4 생산 이력 · RUL 예측 정비 (DashTab4)
   원본: _design_package/smart-factory-mvp/project/design-dashboard.jsx :484-640
   디자인 1:1 매칭 — mock 데이터로 우선 구동 (백엔드 연동은 다음 단계) */
import React from "react";
import { DashShell } from "@/components/parts";

export default function HistoryPage() {
  return (
    <DashShell activeTab={4} scenario="정상"
      headline="설비 예지정비 · RUL 예측"
      sub="누적 이상 카운트 외삽 · 3단계 임계 (경고 / 위험 / 긴급) · 마지막 정비 D-31">

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <div className="kpi cyan">
          <div className="lbl">장비 건강도</div>
          <div className="val num">72<span className="u">/100</span></div>
          <div className="ci">▼ 전주 79 · 누적 이상 ↑</div>
        </div>
        <div className="kpi">
          <div className="lbl">RUL · 잔여 수명</div>
          <div className="val num">8.4<span className="u">일</span></div>
          <div className="ci">95% CI [6.2, 11.1] · 추정치</div>
        </div>
        <div className="kpi red">
          <div className="lbl">정비 권고</div>
          <div className="val" style={{ fontSize: 22, marginTop: 14 }}>● 위험</div>
          <div className="ci">5/27 까지 정비 권장</div>
        </div>
        <div className="kpi">
          <div className="lbl">누적 이상 (30d)</div>
          <div className="val num">42</div>
          <div className="ci">평균 1.4 / day · 전월 0.9</div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div className="h"><span className="ttl">RUL 예측 · 누적 이상 카운트 외삽</span><span className="sub">3단계 임계 (경고 30 / 위험 50 / 긴급 80) · 가정 — 선형 외삽</span></div>
        <div className="b" style={{ flex: 1 }}>
          <svg viewBox="0 0 1300 280" style={{ width: "100%", height: 280, display: "block" }}>
            {[0, 30, 50, 80, 100].map((y) => {
              const Y = 250 - (y / 100) * 220;
              return (
                <g key={y}>
                  <line x1="40" y1={Y} x2="1280" y2={Y} stroke="var(--sx-border)" strokeWidth="0.5" />
                  <text x="34" y={Y + 3} fill="var(--sx-text-3)" fontSize="9" fontWeight="700" textAnchor="end">{y}</text>
                </g>
              );
            })}
            <line x1="40" y1={250 - 30 / 100 * 220} x2="1280" y2={250 - 30 / 100 * 220} stroke="var(--sx-cyan)" strokeWidth="0.6" strokeDasharray="3 2" />
            <text x="1276" y={250 - 30 / 100 * 220 - 4} fill="var(--sx-cyan)" fontSize="9" fontWeight="700" textAnchor="end">경고 30</text>
            <line x1="40" y1={250 - 50 / 100 * 220} x2="1280" y2={250 - 50 / 100 * 220} stroke="#FFA756" strokeWidth="0.6" strokeDasharray="3 2" />
            <text x="1276" y={250 - 50 / 100 * 220 - 4} fill="#FFA756" fontSize="9" fontWeight="700" textAnchor="end">위험 50</text>
            <line x1="40" y1={250 - 80 / 100 * 220} x2="1280" y2={250 - 80 / 100 * 220} stroke="var(--sx-red)" strokeWidth="0.6" strokeDasharray="3 2" />
            <text x="1276" y={250 - 80 / 100 * 220 - 4} fill="var(--sx-red-soft)" fontSize="9" fontWeight="700" textAnchor="end">긴급 80</text>

            <path d="M 40 250 L 90 247 L 150 244 L 210 238 L 270 232 L 330 226 L 390 218 L 450 208 L 510 200 L 570 192 L 630 182 L 690 174 L 750 162"
              stroke="var(--sx-cyan)" strokeWidth="2.2" fill="none" />
            <circle cx="750" cy="162" r="4" fill="var(--sx-cyan)" />
            <text x="755" y="158" fill="var(--sx-cyan)" fontSize="10" fontWeight="800">현재 42 · D-0</text>

            <path d="M 750 162 L 810 148 L 870 134 L 930 116 L 990 96 L 1050 76 L 1110 56 L 1170 36 L 1230 18"
              stroke="var(--sx-red)" strokeWidth="1.6" strokeDasharray="5 3" fill="none" />
            <path d="M 750 162 L 1230 18 L 1230 50 L 750 168 Z" fill="var(--sx-red-bg)" opacity="0.5" />
            <path d="M 750 162 L 1230 0 L 1230 -10 L 750 156 Z" fill="var(--sx-red-bg)" opacity="0.5" />

            <line x1="930" y1="20" x2="930" y2="260" stroke="#FFA756" strokeWidth="0.8" strokeDasharray="2 2" />
            <text x="935" y="32" fill="#FFA756" fontSize="9" fontWeight="800">예측 위험 D+8 (5/27)</text>
            <line x1="1110" y1="20" x2="1110" y2="260" stroke="var(--sx-red)" strokeWidth="0.8" strokeDasharray="2 2" />
            <text x="1115" y="32" fill="var(--sx-red-soft)" fontSize="9" fontWeight="800">예측 긴급 D+18 (6/06)</text>

            {["D−30", "D−25", "D−20", "D−15", "D−10", "D−5", "D+0", "D+5", "D+10", "D+15", "D+20"].map((l, i) => (
              <text key={l} x={40 + i * 124} y="270" fill="var(--sx-text-4)" fontSize="9" fontWeight="700">{l}</text>
            ))}
          </svg>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 12 }}>
        <div className="card">
          <div className="h"><span className="ttl">3단계 정비 임계</span><span className="sub">RUL 외삽 기반</span></div>
          <div className="b" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { lvl: "경고", n: 30, c: "var(--sx-cyan)", b: "var(--sx-cyan-bd)", bg: "var(--sx-cyan-bg)", desc: "누적 30건 · 점검 일정 잡기", days: "D−2" },
              { lvl: "위험", n: 50, c: "#FFA756", b: "rgba(255,167,86,0.4)", bg: "rgba(255,167,86,0.10)", desc: "누적 50건 · 정비 권장", days: "D+8 ★ 현재 예측", active: true },
              { lvl: "긴급", n: 80, c: "var(--sx-red-soft)", b: "var(--sx-red-bd)", bg: "var(--sx-red-bg)", desc: "누적 80건 · 즉시 정비 또는 라인 정지", days: "D+18" },
            ].map(s => (
              <div key={s.lvl} style={{
                padding: "10px 12px", border: "1px solid " + s.b, background: s.bg,
                position: "relative"
              }}>
                {s.active && <span className="corner-tl"></span>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: s.c }}>● {s.lvl}</div>
                  <span className="num" style={{ fontSize: 14, fontWeight: 800, color: s.c }}>≥ {s.n}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--sx-text-3)", fontWeight: 600, marginTop: 4 }}>{s.desc}</div>
                <div className="num" style={{ fontSize: 10, color: "var(--sx-text-2)", fontWeight: 700, marginTop: 4 }}>{s.days}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">100샷 구간 이상률</span><span className="sub">최근 14 구간</span></div>
          <div className="b">
            <svg viewBox="0 0 360 180" style={{ width: "100%", height: 180, display: "block" }}>
              <line x1="20" y1="160" x2="350" y2="160" stroke="var(--sx-border-2)" strokeWidth="0.6" />
              {Array.from({ length: 14 }).map((_, i) => {
                const h = 24 + Math.abs(Math.sin(i * 0.7 + 1)) * 60 + (i > 9 ? 22 : 0);
                const danger = i > 10;
                return (
                  <g key={i}>
                    <rect x={26 + i * 23} y={160 - h} width="18" height={h} fill={danger ? "var(--sx-red)" : "var(--sx-text-3)"} opacity={danger ? 0.85 : 0.55} />
                    <text x={26 + i * 23 + 9} y="172" fill="var(--sx-text-4)" fontSize="7.5" fontWeight="700" textAnchor="middle">{i + 1}</text>
                  </g>
                );
              })}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "var(--sx-text-3)", fontWeight: 600, marginTop: 4 }}>
              <span>최근 14개 구간 · 100샷 단위</span>
              <span style={{ color: "var(--sx-red-soft)" }}>3구간 연속 상승 ↑</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">최다 이상 TOP 10 구간</span><span className="sub">샷 [start–end] · 이상 카운트</span></div>
          <div className="b" style={{ padding: 0 }}>
            <table className="tbl">
              <thead><tr><th>RANK</th><th>구간</th><th>이상</th><th>주센서</th><th>비율</th></tr></thead>
              <tbody>
                {[
                  { r: 1, b: "#1,200–1,299", n: 8, m: "Nozzle_Temp", p: "8%" },
                  { r: 2, b: "#1,100–1,199", n: 7, m: "Hot_Runner", p: "7%" },
                  { r: 3, b: "#0,900–0,999", n: 6, m: "Filling_Time", p: "6%" },
                  { r: 4, b: "#0,600–0,699", n: 5, m: "Cushion_Pos", p: "5%" },
                  { r: 5, b: "#0,400–0,499", n: 4, m: "Peak_Pressure", p: "4%" },
                  { r: 6, b: "#0,500–0,599", n: 3, m: "Inject_Press", p: "3%" },
                  { r: 7, b: "#0,800–0,899", n: 3, m: "Mold_Temp_A", p: "3%" },
                ].map(r => (
                  <tr key={r.r}>
                    <td className="num"><span className="tag" style={{ color: "var(--sx-text-3)" }}>#{r.r.toString().padStart(2, "0")}</span></td>
                    <td className="num">{r.b}</td>
                    <td className="num" style={{ color: "var(--sx-red-soft)" }}>{r.n}</td>
                    <td>{r.m}</td>
                    <td className="num">{r.p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashShell>
  );
}
