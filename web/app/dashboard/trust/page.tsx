"use client";
/* SmartFactory XAI — Tab 5 모델 신뢰도 확인 · 학술 검증 (DashTab5)
   원본: _design_package/smart-factory-mvp/project/design-dashboard.jsx :643-814
   디자인 1:1 매칭 — mock 데이터로 우선 구동 (백엔드 연동은 다음 단계) */
import React, { useEffect, useState } from "react";
import { DashShell } from "@/components/parts";
import { api, MetricsBundle } from "@/lib/api";

const f3 = (x: any, d = "—") => (typeof x === "number" ? x.toFixed(3) : d);
const f4 = (x: any, d = "—") => (typeof x === "number" ? x.toFixed(4) : d);

export default function TrustPage() {
  const [b, setB] = useState<MetricsBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.metrics().then(setB).catch((e) => setErr(e.message || "지표 연결 실패"));
  }, []);

  const m = b?.metrics;
  const cm = b?.ensemble?.ae_alone;  // AE 기준 혼동행렬 (헤드라인 지표와 일치)
  const cons = b?.ensemble?.consensus_modes;
  const base = b?.baseline;
  const stk = b?.stacking;
  const ct = b?.cost_threshold;

  // 합의/방법 비교 테이블 — 실측 JSON에서 구성, F1 내림차순
  const rows: any[] = [];
  if (cons && m && stk && base) {
    const C = (k: string) => cons[k] || {};
    rows.push({ t: "≥4/4 만장일치", d: "4-AI Unanimous", auc: null, ...C(">=4of4"), note: "보수적" });
    rows.push({ t: "≥3/4 엄격", d: "4-AI Hard Voting", auc: null, ...C(">=3of4"), note: "현재 권장", star: true });
    rows.push({ t: "AE 단독", d: "Autoencoder baseline", auc: m.roc_auc, precision: m.precision, recall: m.recall, f1: m.f1, note: "헤드라인" });
    rows.push({ t: "≥2/4 다수결", d: "4-AI Majority", auc: null, ...C(">=2of4"), note: "균형" });
    rows.push({ t: "Stacking (LogReg)", d: "Meta-learner LOOCV", auc: stk.loocv_auc, ...stk.loocv_metrics, note: "오버피팅 의심", est: true });
    rows.push({ t: "≥1/4 합집합", d: "4-AI Union", auc: null, ...C(">=1of4"), note: "FP↑" });
    rows.push({ t: "Isolation Forest", d: "단독", auc: base.isolation_forest.auc, ...base.isolation_forest, note: "단일" });
    rows.push({ t: "One-Class SVM", d: "단독", auc: base.ocsvm.auc, ...base.ocsvm, note: "단일" });
    rows.push({ t: "LOF", d: "단독", auc: base.lof.auc, ...base.lof, note: "단일" });
    rows.sort((a, x) => (x.f1 ?? 0) - (a.f1 ?? 0));
  }

  const costGain = (ct && m) ? ((ct.recommended.precision - m.precision) * 100) : null;

  return (
    <DashShell activeTab={5} scenario="정상"
      headline="모델 신뢰도 확인 · 학술 검증"
      sub={`ROC + PR + Confusion Matrix + 합의 비교 · Bootstrap n=1000 신뢰구간${err ? " · ⚠ 백엔드 미연결" : ""}`}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        <div className="kpi cyan"><div className="lbl">ROC-AUC</div><div className="val num">{f4(m?.roc_auc)}</div><div className="ci">95% CI [{f3(m?.roc_auc_ci_lo)}, {f3(m?.roc_auc_ci_hi)}]</div></div>
        <div className="kpi"><div className="lbl">PR-AUC</div><div className="val num">{f4(m?.pr_auc)}</div><div className="ci">불균형 데이터 핵심 지표</div></div>
        <div className="kpi cyan"><div className="lbl">F1-Score</div><div className="val num">{f4(m?.f1)}</div><div className="ci">τ = {f3(m?.threshold)} · F1-opt</div></div>
        <div className="kpi"><div className="lbl">Recall</div><div className="val num">{f4(m?.recall)}</div><div className="ci">26 / 39 (전체)</div></div>
        <div className="kpi"><div className="lbl">Precision</div><div className="val num">{f4(m?.precision)}</div><div className="ci">26 / 32 · 실측</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="card">
          <div className="h"><span className="ttl">ROC 곡선 · AE</span><span className="sub">AUC {f4(m?.roc_auc)}</span></div>
          <div className="b">
            <svg viewBox="0 0 280 240" style={{ width: "100%", height: 240, display: "block" }}>
              <line x1="30" y1="220" x2="260" y2="220" stroke="var(--sx-border-2)" strokeWidth="0.6" />
              <line x1="30" y1="20" x2="30" y2="220" stroke="var(--sx-border-2)" strokeWidth="0.6" />
              <line x1="30" y1="220" x2="260" y2="20" stroke="var(--sx-border)" strokeWidth="0.5" strokeDasharray="2 2" />
              <path d="M 30 220 Q 40 160, 60 100 Q 100 40, 260 20 L 260 220 Z" fill="var(--sx-cyan-bg)" />
              <path d="M 30 220 Q 40 160, 60 100 Q 100 40, 260 20" stroke="var(--sx-cyan)" strokeWidth="1.8" fill="none" />
              <text x="150" y="120" fill="var(--sx-cyan)" fontSize="18" fontWeight="800" fontFamily="ui-monospace">{f4(m?.roc_auc)}</text>
              <text x="145" y="234" fill="var(--sx-text-3)" fontSize="9" fontWeight="700" textAnchor="middle">FPR</text>
              <text x="14" y="120" fill="var(--sx-text-3)" fontSize="9" fontWeight="700" textAnchor="middle" transform="rotate(-90 14 120)">TPR</text>
            </svg>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">PR 곡선 · AE</span><span className="sub">AUC {f4(m?.pr_auc)}</span></div>
          <div className="b">
            <svg viewBox="0 0 280 240" style={{ width: "100%", height: 240, display: "block" }}>
              <line x1="30" y1="220" x2="260" y2="220" stroke="var(--sx-border-2)" strokeWidth="0.6" />
              <line x1="30" y1="20" x2="30" y2="220" stroke="var(--sx-border-2)" strokeWidth="0.6" />
              <path d="M 30 30 L 70 36 Q 130 60, 180 130 Q 220 180, 260 218" stroke="var(--sx-cyan-soft)" strokeWidth="1.8" fill="none" />
              <text x="100" y="100" fill="var(--sx-cyan-soft)" fontSize="18" fontWeight="800" fontFamily="ui-monospace">{f4(m?.pr_auc)}</text>
              <text x="145" y="234" fill="var(--sx-text-3)" fontSize="9" fontWeight="700" textAnchor="middle">Recall</text>
              <text x="14" y="120" fill="var(--sx-text-3)" fontSize="9" fontWeight="700" textAnchor="middle" transform="rotate(-90 14 120)">Precision</text>
            </svg>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">Confusion Matrix</span><span className="sub">검증 1,379</span></div>
          <div className="b">
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 1fr", gridTemplateRows: "24px 1fr 1fr", gap: 4 }}>
              <div></div>
              <div style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "var(--sx-text-3)", letterSpacing: 0.6 }}>PRED N</div>
              <div style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "var(--sx-text-3)", letterSpacing: 0.6 }}>PRED D</div>
              <div style={{ display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, color: "var(--sx-text-3)" }}>TRUE N</div>
              <div style={{ background: "var(--sx-cyan-bg)", border: "1px solid var(--sx-cyan-bd)", padding: "18px 8px", textAlign: "center" }}>
                <div className="num" style={{ fontSize: 24, color: "var(--sx-cyan)", fontWeight: 800 }}>{cm ? cm.tn.toLocaleString() : "—"}</div>
                <div className="eyebrow" style={{ color: "var(--sx-cyan)", marginTop: 4 }}>TN</div>
              </div>
              <div style={{ background: "var(--sx-red-bg)", border: "1px solid var(--sx-red-bd)", padding: "18px 8px", textAlign: "center" }}>
                <div className="num" style={{ fontSize: 24, color: "var(--sx-red-soft)", fontWeight: 800 }}>{cm ? cm.fp : "—"}</div>
                <div className="eyebrow" style={{ color: "var(--sx-red-soft)", marginTop: 4 }}>FP</div>
              </div>
              <div style={{ display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, color: "var(--sx-text-3)" }}>TRUE D</div>
              <div style={{ background: "var(--sx-red-bg)", border: "1px solid var(--sx-red-bd)", padding: "18px 8px", textAlign: "center" }}>
                <div className="num" style={{ fontSize: 24, color: "var(--sx-red-soft)", fontWeight: 800 }}>{cm ? cm.fn : "—"}</div>
                <div className="eyebrow" style={{ color: "var(--sx-red-soft)", marginTop: 4 }}>FN</div>
              </div>
              <div style={{ background: "var(--sx-cyan-bg)", border: "1px solid var(--sx-cyan-bd)", padding: "18px 8px", textAlign: "center" }}>
                <div className="num" style={{ fontSize: 24, color: "var(--sx-cyan)", fontWeight: 800 }}>{cm ? cm.tp : "—"}</div>
                <div className="eyebrow" style={{ color: "var(--sx-cyan)", marginTop: 4 }}>TP</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
        <div className="card">
          <div className="h">
            <span className="ttl">합의 알고리즘 비교 · {rows.length || "—"}가지 (정직 공개)</span>
            <span className="sub">Stacking·단독 베이스라인 포함 · F1 기준 정렬 <span className="tag real" style={{ marginLeft: 4 }}>실측</span></span>
          </div>
          <div className="b" style={{ padding: 0 }}>
            <table className="tbl">
              <thead><tr><th>방법</th><th>설명</th><th>ROC-AUC</th><th>Precision</th><th>Recall</th><th>F1 ★</th><th>비고</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.t} style={r.star ? { background: "var(--sx-cyan-bg)" } : {}}>
                    <td><span className={"tag" + (r.star ? " cyan" : "")}>{r.t}</span></td>
                    <td>{r.d}</td>
                    <td className="num">{f4(r.auc)}</td>
                    <td className="num">{f3(r.precision)}</td>
                    <td className="num">{f3(r.recall)}</td>
                    <td className="num" style={r.star ? { color: "var(--sx-cyan)", fontWeight: 800 } : {}}>{f3(r.f1)}{r.star ? " ★" : ""}</td>
                    <td>{r.est ? <span className="tag est">{r.note}</span> : r.note}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={7} style={{ color: "var(--sx-text-3)", padding: 12 }}>지표 로딩 중…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <div className="h"><span className="ttl">Cost-Sensitive Threshold</span><span className="sub">불량 비용 ≫ FP 비용</span></div>
            <div className="b">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div>
                  <div className="eyebrow">F1-OPT τ</div>
                  <div className="num" style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{f4(ct?.f1_optimal_threshold)}</div>
                </div>
                <div style={{ color: "var(--sx-text-4)", fontSize: 14 }}>→</div>
                <div>
                  <div className="eyebrow" style={{ color: "var(--sx-cyan)" }}>COST-OPT τ</div>
                  <div className="num" style={{ fontSize: 24, fontWeight: 800, color: "var(--sx-cyan)", marginTop: 4 }}>{f4(ct?.recommended?.threshold)}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--sx-text-2)", fontWeight: 600, marginTop: 14, lineHeight: 1.55 }}>
                비용 가중 τ 적용 시 Precision <span className="num" style={{ color: "var(--sx-cyan)" }}>{costGain !== null ? (costGain >= 0 ? "+" : "") + costGain.toFixed(1) + " %p" : "—"}</span> 상승 ({f3(m?.precision)} → {f3(ct?.recommended?.precision)}). 총 비용 <span className="num">{ct?.recommended?.total_cost_man ?? "—"}만원</span>.
                <span className="tag assume" style={{ marginLeft: 6 }}>가정 — 사내 비용 모델</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="h"><span className="ttl">학술 레퍼런스</span><span className="sub">7건</span></div>
            <div className="b" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { t: "AE / Bengio 2014", c: "Deep Learning AE" },
                { t: "IF / Liu et al. 2008", c: "ICDM" },
                { t: "OCSVM / Schölkopf 2001", c: "Support Estimation" },
                { t: "LOF / Breunig et al. 2000", c: "SIGMOD" },
                { t: "SHAP / Lundberg 2017", c: "NIPS" },
                { t: "DeepSHAP / Chen 2019", c: "Propagation" },
                { t: "ISO 17359:2018", c: "Condition Monitoring" },
              ].map(r => (
                <div key={r.t} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 600, color: "var(--sx-text-2)" }}>
                  <span style={{ color: "var(--sx-cyan)" }}>{r.t}</span>
                  <span style={{ color: "var(--sx-text-4)" }}>{r.c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashShell>
  );
}
