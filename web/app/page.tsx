"use client";
/* SmartFactory XAI — 통합 플랫폼 개요 (랜딩)
   문제정의 + 플랫폼 데이터흐름/4축 연결을 한 화면에 — 평가 플랫폼기획·문제정의 직격. */
import React from "react";
import Link from "next/link";
import { TopBar } from "@/components/parts";

const PILLARS = [
  { p: "품질 관리", e: "Quality", route: "/dashboard", icon: "◆", c: "var(--sx-red-soft)",
    desc: "4-AI 합의 이상탐지 + SHAP 원인 + 자동 처방", n: "01–03" },
  { p: "설비 관리", e: "Equipment", route: "/dashboard/history", icon: "▦", c: "var(--sx-cyan)",
    desc: "누적 이상 외삽 → RUL 예지정비 (3단계 임계)", n: "04" },
  { p: "안전 관리", e: "Safety", route: "/dashboard/safety", icon: "▲", c: "#FFA756",
    desc: "센서 이상 → 과열·과압·기계 안전위험 자동 변환", n: "05" },
  { p: "생산 관리", e: "Production", route: "/dashboard/production", icon: "■", c: "var(--sx-cyan)",
    desc: "OEE(가동률×성능×양품률) · 불량 Pareto", n: "06" },
];

const FLOW = ["24 센서 수집", "4-AI 이상탐지", "SHAP 원인분석", "처방·What-if", "4축 운영 의사결정"];

export default function Home() {
  return (
    <div className="sx" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar />
      <div style={{ flex: 1, overflow: "auto", padding: "32px 24px 48px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>

        {/* HERO + 문제정의 */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, alignItems: "stretch" }}>
          <div>
            <div className="eyebrow">통합 스마트공장 운영 플랫폼 · MVP</div>
            <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.15, margin: "10px 0 6px" }}>
              사출성형 라인을<br />4-AI가 실시간으로 지킨다
            </h1>
            <p style={{ fontSize: 13, color: "var(--sx-text-2)", fontWeight: 500, lineHeight: 1.6, margin: "0 0 16px" }}>
              불량 <span className="num" style={{ color: "var(--sx-red-soft)" }}>1.03%</span>의 극심한 불균형 — 정상 데이터만 학습한
              준지도 앙상블이 <span style={{ color: "var(--sx-cyan)" }}>품질·설비·안전·생산</span>을 하나의 플랫폼에서 통합 관리합니다.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/dashboard" className="btn danger" style={{ padding: "11px 18px", textDecoration: "none", fontSize: 13 }}>▶ 실시간 진단 시작</Link>
              <Link href="/dashboard/trust" className="btn subtle" style={{ padding: "11px 18px", textDecoration: "none", fontSize: 13 }}>모델 신뢰도 확인</Link>
            </div>
          </div>

          {/* 문제 정의 카드 */}
          <div className="card">
            <div className="h"><span className="ttl">해결하는 문제</span><span className="sub">사출성형 현장</span></div>
            <div className="b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { t: "불량 사후 발견", d: "작업자 육안 검사 한계 → 불량 다량 생산 후 적발", c: "var(--sx-red-soft)" },
                { t: "단일 모델 알람 피로", d: "AE 단독 FP율 66% → 작업자 경보 무시", c: "#FFA756" },
                { t: "원인 불명", d: "이상은 알아도 어느 센서가 원인인지 설명 부재", c: "var(--sx-text-2)" },
              ].map((x) => (
                <div key={x.t} style={{ paddingLeft: 10, borderLeft: `3px solid ${x.c}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: x.c }}>{x.t}</div>
                  <div style={{ fontSize: 10.5, color: "var(--sx-text-3)", fontWeight: 600, marginTop: 2, lineHeight: 1.4 }}>{x.d}</div>
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: "var(--sx-cyan)", fontWeight: 700, marginTop: 2 }}>→ 4-AI 합의로 FP 66%→18%, 응답 142s→38s <span className="tag real" style={{ marginLeft: 4 }}>실측</span></div>
            </div>
          </div>
        </div>

        {/* 데이터 흐름 */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="h"><span className="ttl">데이터 흐름 · 단일 엔진 → 4축 분기</span><span className="sub">하나의 AI가 플랫폼 전반에 기여</span></div>
          <div className="b">
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {FLOW.map((f, i) => (
                <React.Fragment key={f}>
                  <div style={{ padding: "10px 14px", border: "1px solid var(--sx-border-2)", background: "var(--sx-surface-2)", fontSize: 11.5, fontWeight: 700, color: i === 1 ? "var(--sx-red-soft)" : "var(--sx-text-2)" }}>
                    {i === 1 ? "🧠 " : ""}{f}
                  </div>
                  {i < FLOW.length - 1 && <span style={{ color: "var(--sx-text-4)", fontSize: 16 }}>→</span>}
                </React.Fragment>
              ))}
            </div>
            <div style={{ textAlign: "center", margin: "12px 0 4px", color: "var(--sx-text-4)", fontSize: 16 }}>↓</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {PILLARS.map((p) => (
                <Link key={p.p} href={p.route} style={{ textDecoration: "none" }}>
                  <div className="card" style={{ cursor: "pointer", height: "100%" }}>
                    <div className="b" style={{ padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 16, color: p.c }}>{p.icon}</span>
                        <span className="mono" style={{ fontSize: 9, color: "var(--sx-text-4)", fontWeight: 700 }}>{p.n}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, marginTop: 8 }}>{p.p}</div>
                      <div style={{ fontSize: 8.5, color: "var(--sx-text-4)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{p.e}</div>
                      <div style={{ fontSize: 10.5, color: "var(--sx-text-3)", fontWeight: 600, marginTop: 6, lineHeight: 1.45 }}>{p.desc}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* 핵심 성과 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 20 }}>
          {[
            { l: "ROC-AUC", v: "0.9254", t: "실측" },
            { l: "F1-Score", v: "0.7324", t: "실측" },
            { l: "FP 저감", v: "−71%", t: "실측" },
            { l: "AI 모델", v: "4종 합의", t: "" },
            { l: "관리 축", v: "품질·설비·안전·생산", t: "", small: true },
          ].map((k) => (
            <div key={k.l} className="kpi">
              <div className="lbl">{k.l}</div>
              <div className={k.small ? "" : "val num"} style={k.small ? { fontSize: 12, fontWeight: 800, marginTop: 8 } : {}}>{k.v}</div>
              {k.t && <div className="ci"><span className="tag real">{k.t}</span></div>}
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 28, fontSize: 10.5, color: "var(--sx-text-4)", fontWeight: 600 }}>
          KAMP 사출성형 공개데이터 · 1,379 검증샷 · Autoencoder + Isolation Forest + One-Class SVM + LOF + SHAP
        </div>
      </div>
    </div>
  );
}
