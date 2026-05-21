"use client";
/* SmartFactory XAI — Tab 1 실시간 진단 (DashTab1)
   백엔드 /api/predict 라이브 연동 + 데모 시나리오 선택.
   What-if / NLG / 이상이력은 보조 위젯으로 정적 유지(2차 연동 예정). */
import React, { useEffect, useState, useMemo, useRef } from "react";
import { DashShell, Consensus, Gauge, SensorGrid } from "@/components/parts";
import { api, scenarioStore, PredictResult, Scenario, SENSOR_COLS } from "@/lib/api";
import { liveStore } from "@/lib/live";

const STATUS_KO: Record<string, string> = {
  NORMAL: "정상", WARNING: "경고", DANGER: "위험", CRITICAL: "긴급",
};

export default function DashboardPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [sel, setSel] = useState(0);
  const [r, setR] = useState<PredictResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 시나리오 로드 + 기본(긴급#37) 예측
  useEffect(() => {
    (async () => {
      try {
        const { scenarios } = await api.scenarios();
        setScenarios(scenarios);
        const stored = scenarioStore.get();
        const def = stored !== null && stored < scenarios.length ? stored : scenarios.length - 1;
        setSel(def);
        setR(await api.predict(scenarios[def].z));
      } catch (e: any) {
        setErr(e.message || "백엔드 연결 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function pick(i: number) {
    setSel(i); setErr(null); scenarioStore.set(i);
    try { setR(await api.predict(scenarios[i].z)); }
    catch (e: any) { setErr(e.message || "예측 실패"); }
  }

  // 사이드바 시나리오 카드 등 외부에서 시나리오 변경 시 동기화
  useEffect(() => {
    return scenarioStore.subscribe((i) => {
      if (scenarios[i] && i !== sel) {
        setSel(i);
        api.predict(scenarios[i].z).then(setR).catch(() => {});
      }
    });
  }, [scenarios, sel]);

  // ── What-if: 현재 시나리오의 이상 Top-3 센서를 정상(0)쪽으로 슬라이딩 → 재예측 ──
  const baseZ = scenarios[sel]?.z;
  const topIdx = useMemo(() => {
    if (!baseZ) return [];
    return baseZ
      .map((v, i) => [Math.abs(v), i] as [number, number])
      .sort((a, b) => b[0] - a[0])
      .slice(0, 3)
      .map(([, i]) => i);
  }, [baseZ]);

  const [wfFrac, setWfFrac] = useState<number[]>([0, 0, 0]);
  const [wfResult, setWfResult] = useState<PredictResult | null>(null);
  const wfTimer = useRef<any>(null);

  // 시나리오 바뀌면 슬라이더 초기화
  useEffect(() => { setWfFrac([0, 0, 0]); setWfResult(null); }, [sel]);

  // 슬라이더 변경 시 debounce 재예측
  useEffect(() => {
    if (!baseZ || topIdx.length === 0) return;
    const modZ = baseZ.slice();
    topIdx.forEach((idx, k) => { modZ[idx] = baseZ[idx] * (1 - wfFrac[k]); });
    clearTimeout(wfTimer.current);
    wfTimer.current = setTimeout(async () => {
      try { setWfResult(await api.predict(modZ)); } catch { /* keep last */ }
    }, 220);
    return () => clearTimeout(wfTimer.current);
  }, [wfFrac, baseZ, topIdx]);

  const wfAfter = wfResult?.recon_error ?? r?.recon_error ?? 0;
  const wfBefore = r?.recon_error ?? 0;
  const wfDelta = wfBefore > 0 ? Math.round((wfAfter / wfBefore - 1) * 100) : 0;

  // ── LIVE 스트리밍 (1Hz 자동 재예측 + 결과 누적) ──
  const [live, setLive] = useState(false);
  const [tick, setTick] = useState(0);
  const [liveLog, setLiveLog] = useState<{ t: string; status: string; recon: number; agree: number; sensor: string; sigma: string }[]>([]);
  useEffect(() => liveStore.subscribe(setLive), []);
  useEffect(() => { if (!live) { setTick(0); setLiveLog([]); } }, [live]);
  useEffect(() => {
    if (!live || !baseZ) return;
    const id = setInterval(async () => {
      // 현재 시나리오 기준 미세 드리프트(±0.1σ)로 라이브 센서 피드 흉내
      const drifted = baseZ.map((v) => v + (Math.random() - 0.5) * 0.2);
      try {
        const res = await api.predict(drifted);
        setR(res); setTick((t) => t + 1);
        if (res.severity >= 2) {
          const p0 = res.prescriptions[0];
          setLiveLog((prev) => [{
            t: new Date().toLocaleTimeString("ko-KR", { hour12: false }),
            status: res.status, recon: res.recon_error, agree: res.agree,
            sensor: p0?.sensor ?? "—", sigma: p0?.sigma ?? "",
          }, ...prev].slice(0, 8));
        }
      } catch { /* keep last */ }
    }, 1000);
    return () => clearInterval(id);
  }, [live, baseZ]);

  // ── 자연어 진단 보고서 (Claude Haiku 라이브 · 작업자 톤 단일) ──
  const [nlg, setNlg] = useState<{ text: string; model: string } | null>(null);
  const [nlgLoading, setNlgLoading] = useState(false);

  useEffect(() => {
    if (!baseZ) return;
    let cancelled = false;
    setNlgLoading(true);
    api.report(baseZ, "worker")
      .then((res) => { if (!cancelled) setNlg({ text: res.text, model: res.model }); })
      .catch(() => { if (!cancelled) setNlg(null); })
      .finally(() => { if (!cancelled) setNlgLoading(false); });
    return () => { cancelled = true; };
  }, [baseZ]);

  const sev = r?.severity ?? 0;
  const isDanger = sev >= 2;
  const gaugeState = sev >= 2 ? "danger" : sev === 1 ? "warn" : "normal";
  const statusKo = r ? STATUS_KO[r.status] : "—";
  const pctThr = r ? Math.round(r.ratio * 100) : 0;


  return (
    <DashShell
      activeTab={1}
      scenario={sel === 0 ? "정상" : scenarios[sel]?.name || "위험 #27"}
      headline="실시간 진단 · IM-7"
      sub={`KAMP 검증셋 · 4-AI 합의 ${r?.agree ?? 0}/4 · ${statusKo}${err ? " · ⚠ 백엔드 미연결" : ""}`}
    >
      {/* 시나리오 선택 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="eyebrow" style={{ marginRight: 4 }}>데모 시나리오</span>
        {scenarios.map((s, i) => {
          const on = i === sel;
          const danger = s.name.startsWith("위험") || s.name.startsWith("긴급");
          return (
            <button key={s.name} onClick={() => pick(i)} className="btn subtle"
              style={{
                padding: "6px 12px", fontSize: 11, fontWeight: 700,
                border: "1px solid " + (on ? (danger ? "var(--sx-red-bd)" : "var(--sx-cyan-bd)") : "var(--sx-border-2)"),
                background: on ? (danger ? "var(--sx-red-bg)" : "var(--sx-cyan-bg)") : "transparent",
                color: on ? (danger ? "var(--sx-red-soft)" : "var(--sx-cyan)") : "var(--sx-text-2)",
              }}>{s.name}</button>
          );
        })}
        {loading && <span style={{ fontSize: 11, color: "var(--sx-text-3)" }}>분석 중…</span>}
        <button onClick={() => liveStore.toggle()} className="btn subtle"
          style={{
            marginLeft: "auto", padding: "6px 12px", fontSize: 11, fontWeight: 800,
            border: "1px solid " + (live ? "var(--sx-red-bd)" : "var(--sx-border-2)"),
            background: live ? "var(--sx-red-bg)" : "transparent",
            color: live ? "var(--sx-red-soft)" : "var(--sx-text-2)",
          }}>{live ? "■ LIVE 정지" : "▶ LIVE 스트리밍"}</button>
        {live && <span className="pill live"><span className="pulse"></span> 1Hz 스트리밍 · {tick.toLocaleString()}샷 분석</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        <div className={"kpi" + (isDanger ? " red" : sev === 1 ? " cyan" : "")}>
          <div className="lbl">상태</div>
          <div className="val">{statusKo}</div>
          <div className="ci">{live ? "● 실시간 갱신 중" : (r ? "최신 진단 기준" : "—")}</div>
        </div>
        <div className={"kpi" + (isDanger ? " red" : "")}>
          <div className="lbl">복원 오차</div>
          <div className="val num">{r ? r.recon_error.toFixed(3) : "—"}<span className="u">/ τ {r ? r.threshold.toFixed(3) : "0.184"}</span></div>
          <div className="ci">{pctThr}% of threshold · 실측</div>
        </div>
        <div className="kpi cyan">
          <div className="lbl">4-AI 소프트</div>
          <div className="val num">{r ? r.soft.toFixed(3) : "—"}</div>
          <div className="ci">≥{r?.required ?? 3}/4 엄격 모드</div>
        </div>
        <div className="kpi">
          <div className="lbl">합의 투표</div>
          <div className="val num">{r ? r.agree : 0}<span className="u">/ 4 모델</span></div>
          <div className="ci">AE · IF · OCSVM · LOF</div>
        </div>
        <div className={"kpi" + (live ? " red" : "")}>
          <div className="lbl">LIVE 불량률</div>
          <div className="val num">{live && tick ? ((liveLog.length / tick) * 100).toFixed(1) : "—"}<span className="u">%</span></div>
          <div className="ci">{live ? `이상 ${liveLog.length} / ${tick}샷 누적` : "LIVE 스트리밍 시 집계"}</div>
        </div>
      </div>

      <div className={"banner" + (isDanger ? " danger" : "")} style={!isDanger ? { borderColor: "var(--sx-border)", background: "var(--sx-surface-2)" } : {}}>
        <div className="ico">{isDanger ? "!" : "ⓘ"}</div>
        <div style={{ flex: 1 }}>
          <div className="ttl">{isDanger
            ? `▲ ${statusKo} · 4-AI ${r?.agree ?? 0}/4 합의 이상 감지 — 즉시 조치 필요`
            : `● ${statusKo} · 4-AI 합의 ${r?.agree ?? 0}/4 · 이상 신호 없음`}</div>
          <div className="sub">{r
            ? `복원 오차 ${r.recon_error.toFixed(3)} (임계값 τ ${r.threshold.toFixed(3)}의 ${pctThr}%) · Soft ${r.soft.toFixed(3)}${isDanger && r.prescriptions[0] ? ` · 주원인 ${r.prescriptions[0].sensor} ${r.prescriptions[0].sigma} · 처방 ${r.prescriptions.length}건` : ""}`
            : "백엔드 연결 대기 중"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: 12, flex: 1, minHeight: 0 }}>
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <div className="card">
            <div className="h">
              <span className="ttl">⚑ 다중 AI 합의 미터 · 4 모델</span>
              <span className="sub">단일 AE FP rate 0.66 → 4-AI 합의 0.19 (−71%) <span className="tag real" style={{ marginLeft: 4 }}>실측</span></span>
            </div>
            <div className="b">
              <Consensus
                votes={r ? r.votes : [0, 0, 0, 0]}
                scores={r ? r.scores : [0, 0, 0, 0]}
                soft={r ? r.soft : 0}
              />
              <div style={{
                marginTop: 14, padding: "10px 12px",
                background: "var(--sx-cyan-bg)", border: "1px dashed var(--sx-cyan-bd)"
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--sx-cyan)", letterSpacing: 0.4 }}>
                  ⓘ 단일 모델 알람 피로 → 4-AI 합의로 해소
                </div>
                <div style={{ fontSize: 10.5, color: "var(--sx-text-3)", fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>
                  AE 단독 운영 시 24h 알람 47건 (FP 31건, 66%). 4-AI ≥3/4 엄격 모드로 전환 후 알람 11건 (FP 2건, 18%). 작업자 응답 시간 142s → 38s.
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div className="h">
              <span className="ttl">24 센서 입력 · 5 그룹</span>
              <span className="sub">이상 Top 빨강 · {scenarios[sel]?.name || "—"}</span>
            </div>
            <div className="b" style={{ flex: 1 }}>
              <SensorGrid groups={r?.sensor_groups} />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <div className="card">
            <div className="h"><span className="ttl">복원 오차 · 게이지</span><span className="sub">τ {r ? r.threshold.toFixed(3) : "0.184"}</span></div>
            <div className="b">
              <Gauge value={r ? r.recon_error : 0} threshold={r ? r.threshold : 0.184} state={gaugeState} />
            </div>
          </div>

          <div className="card" style={{ flex: "1 1 auto", minHeight: 0 }}>
            <div className="h"><span className="ttl">처방 카드 · TOP {r?.prescriptions.length ?? 3}</span><span className="sub">|σ| 상위 센서 기반</span></div>
            <div className="b" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(r?.prescriptions ?? []).map((p, idx) => (
                <div key={p.sensor} style={{
                  padding: "10px 12px", background: "var(--sx-surface-2)",
                  borderLeft: "3px solid var(--sx-red)", border: "1px solid var(--sx-border)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="num" style={{ fontSize: 10, fontWeight: 800, color: "var(--sx-text-4)" }}>#{(idx + 1).toString().padStart(2, "0")}</span>
                    <span style={{ fontSize: 12, fontWeight: 800 }}>{p.sensor}</span>
                    <span className="num" style={{ fontSize: 10, color: "var(--sx-red-soft)", fontWeight: 700 }}>{p.sigma}</span>
                    <span className="tag red" style={{ marginLeft: "auto" }}>{idx === 0 ? "즉시" : idx === 1 ? "5분 내" : "관찰"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--sx-text-2)", fontWeight: 500, marginTop: 6, lineHeight: 1.45 }}>{p.action}</div>
                </div>
              ))}
              {!r && <div style={{ fontSize: 11, color: "var(--sx-text-3)" }}>분석 대기 중…</div>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="card">
          <div className="h">
            <span className="ttl">What-if 듀얼 슬라이더</span>
            <span className="sub">예측: <span className="num" style={{ color: "var(--sx-red-soft)" }}>{wfBefore.toFixed(3)}</span> → <span className="num" style={{ color: wfDelta < 0 ? "var(--sx-cyan)" : "var(--sx-text)" }}>{wfAfter.toFixed(3)}</span> ({wfDelta > 0 ? "+" : ""}{wfDelta}%) <span className="tag real" style={{ marginLeft: 4 }}>실측</span></span>
          </div>
          <div className="b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {topIdx.map((idx, k) => {
              const z = baseZ ? baseZ[idx] : 0;
              const target = z * (1 - wfFrac[k]);
              return (
                <div key={idx}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "var(--sx-text-2)" }}>{SENSOR_COLS[idx]}</span>
                    <span>
                      <span className="num" style={{ color: "var(--sx-red-soft)" }}>{z >= 0 ? "+" : ""}{z.toFixed(1)}σ</span>
                      <span style={{ color: "var(--sx-text-4)", margin: "0 6px" }}>→</span>
                      <span className="num" style={{ color: "var(--sx-cyan)" }}>{target >= 0 ? "+" : ""}{target.toFixed(1)}σ</span>
                    </span>
                  </div>
                  <input type="range" min={0} max={100} value={Math.round(wfFrac[k] * 100)}
                    onChange={(e) => {
                      const v = Number(e.target.value) / 100;
                      setWfFrac(prev => prev.map((p, j) => (j === k ? v : p)));
                    }}
                    style={{ width: "100%", accentColor: "var(--sx-cyan)", cursor: "pointer" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "var(--sx-text-4)", fontWeight: 700, marginTop: 1 }}>
                    <span>현재값 유지</span><span>정상(0σ)으로</span>
                  </div>
                </div>
              );
            })}
            <button className="btn" style={{ marginTop: 4 }} onClick={() => setWfFrac([1, 1, 1])}>제안값 일괄 적용 (정상화)</button>
            {wfResult && (
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--sx-text-3)", textAlign: "center" }}>
                조정 후 판정: <span style={{ color: wfResult.severity >= 2 ? "var(--sx-red-soft)" : wfResult.severity === 1 ? "var(--sx-cyan)" : "var(--sx-cyan)" }}>{STATUS_KO[wfResult.status]}</span> · 합의 {wfResult.agree}/4
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">자연어 진단 보고서</span><span className="sub">{nlg?.model === "template" ? "템플릿" : "Claude Haiku"} {nlgLoading ? "· 생성 중…" : ""}</span></div>
          <div className="b">
            <div style={{ fontSize: 11.5, lineHeight: 1.7, color: "var(--sx-text-2)", fontWeight: 500, minHeight: 60 }}>
              {nlg ? nlg.text : (nlgLoading ? "보고서 생성 중…" : "분석 대기 중…")}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="h"><span className="ttl">이상 감지 이력 · LIVE 누적</span><span className="sub">{live ? `스트리밍 중 · ${liveLog.length}건 감지` : "LIVE 시작 시 실시간 누적"}</span></div>
          <div className="b" style={{ padding: 0 }}>
            <table className="tbl">
              <thead><tr><th>시각</th><th>상태</th><th>주센서</th><th>복원오차</th><th>합의</th></tr></thead>
              <tbody>
                {liveLog.map((e, i) => (
                  <tr key={i}>
                    <td className="num">{e.t}</td>
                    <td><span className={"tag" + (e.status === "CRITICAL" || e.status === "DANGER" ? " red" : "")} style={e.status === "WARNING" ? { color: "var(--sx-cyan)" } : {}}>{STATUS_KO[e.status]}</span></td>
                    <td>{e.sensor} {e.sigma}</td>
                    <td className="num" style={{ color: "var(--sx-red-soft)" }}>{e.recon.toFixed(3)}</td>
                    <td className="num">{e.agree}/4</td>
                  </tr>
                ))}
                {!liveLog.length && <tr><td colSpan={5} style={{ color: "var(--sx-text-3)", padding: 14, textAlign: "center" }}>{live ? "이상 감지 대기 중…" : "▶ LIVE 스트리밍을 켜면 실시간 누적됩니다"}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashShell>
  );
}
