"use client";
/* SmartFactory XAI — Tab 1 실시간 진단 (DashTab1)
   백엔드 /api/predict 라이브 연동 + 데모 시나리오 선택.
   What-if / NLG / 이상이력은 보조 위젯으로 정적 유지(2차 연동 예정). */
import React, { useEffect, useState, useMemo, useRef } from "react";
import { DashShell, Consensus, Gauge, SensorGrid } from "@/components/parts";
import { api, scenarioStore, PredictResult, Scenario, SENSOR_COLS } from "@/lib/api";

const STATUS_KO: Record<string, string> = {
  NORMAL: "정상", WARNING: "경고", DANGER: "위험", CRITICAL: "긴급",
};

export default function DashboardPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [sel, setSel] = useState(0);
  const [r, setR] = useState<PredictResult | null>(null);
  const [baseR, setBaseR] = useState<PredictResult | null>(null);  // 시나리오 고정 baseline (스트리밍과 독립)
  const [ens, setEns] = useState<any>(null);  // 실측 합의 비교 (ensemble_metrics)
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.metrics().then((b) => setEns(b.ensemble)).catch(() => {}); }, []);

  // 시나리오 로드 + 기본(긴급#37) 예측
  useEffect(() => {
    (async () => {
      try {
        const { scenarios } = await api.scenarios();
        setScenarios(scenarios);
        const stored = scenarioStore.get();
        const def = stored !== null && stored < scenarios.length ? stored : scenarios.length - 1;
        setSel(def);
        const pr = await api.predict(scenarios[def].z);
        setR(pr); setBaseR(pr);
      } catch (e: any) {
        setErr(e.message || "백엔드 연결 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function pick(i: number) {
    setSel(i); setErr(null); scenarioStore.set(i);
    try { const pr = await api.predict(scenarios[i].z); setR(pr); setBaseR(pr); }
    catch (e: any) { setErr(e.message || "예측 실패"); }
  }

  // 사이드바 시나리오 카드 등 외부에서 시나리오 변경 시 동기화
  useEffect(() => {
    return scenarioStore.subscribe((i) => {
      if (scenarios[i] && i !== sel) {
        setSel(i);
        api.predict(scenarios[i].z).then((pr) => { setR(pr); setBaseR(pr); }).catch(() => {});
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

  // What-if 기준은 시나리오 고정 baseline(baseR) — 라이브 스트리밍(r)과 무관하게 안정
  const wfBefore = baseR?.recon_error ?? 0;
  const wfAfter = wfResult?.recon_error ?? wfBefore;
  const wfDelta = wfBefore > 0 ? Math.round((wfAfter / wfBefore - 1) * 100) : 0;

  // ── LIVE 스트리밍: 데모(시나리오+노이즈) | 실측 KAMP 리플레이 (상호 배타) ──
  const [liveMode, setLiveMode] = useState<"off" | "demo" | "kamp">("off");
  const live = liveMode !== "off";
  const [tick, setTick] = useState(0);
  // 이상 이력: 시각 + 전체 예측결과 저장(클릭 시 카드에 복원). 스트림 정지해도 보존 → 드롭다운 탐색.
  const [liveLog, setLiveLog] = useState<{ t: string; res: PredictResult }[]>([]);
  const [selectedT, setSelectedT] = useState<string | null>(null);  // 이력에서 골라 고정 보기 중인 샷
  const [shots, setShots] = useState<number[][] | null>(null);
  const shotIdx = useRef(0);

  useEffect(() => {
    if (liveMode === "off") return;
    if (liveMode === "demo" && !baseZ) return;
    if (liveMode === "kamp" && !shots) return;
    const id = setInterval(async () => {
      // 데모: 선택 시나리오 + 미세 노이즈 / KAMP: 실측 검증샷을 한 개씩 재생
      const z = liveMode === "demo"
        ? baseZ!.map((v) => v + (Math.random() - 0.5) * 0.2)
        : shots![(shotIdx.current++) % shots!.length];
      try {
        const res = await api.predict(z);
        setR(res); setTick((t) => t + 1);
        if (res.severity >= 1) {  // 경고·위험·긴급 모두 이상으로 기록
          const t = new Date().toLocaleTimeString("ko-KR", { hour12: false });
          setLiveLog((prev) => [{ t, res }, ...prev].slice(0, 50));  // 최근 50건 보존(드롭다운용)
        }
      } catch { /* keep last */ }
    }, 1000);
    return () => clearInterval(id);
  }, [liveMode, baseZ, shots]);

  function resetLive() { setTick(0); setLiveLog([]); setSelectedT(null); }
  async function startKamp() {
    if (liveMode === "kamp") { setLiveMode("off"); return; }   // 정지 — 이력 보존
    if (!shots) { try { const d = await api.shots(); setShots(d.shots); } catch { return; } }
    shotIdx.current = 0; resetLive(); setLiveMode("kamp");
  }
  function startDemo() {
    if (liveMode === "demo") { setLiveMode("off"); return; }
    resetLive(); setLiveMode("demo");
  }
  // 이상 이력 행/드롭다운에서 샷 선택 → 스트림 정지하고 그 샷을 카드에 고정 표시
  function viewShot(entry: { t: string; res: PredictResult }) {
    setLiveMode("off"); setR(entry.res); setSelectedT(entry.t);
  }
  function clearSelection() { setSelectedT(null); if (baseR) setR(baseR); }

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
        <button onClick={startKamp} disabled={liveMode === "demo"} className="btn subtle"
          style={{
            marginLeft: "auto", padding: "6px 12px", fontSize: 11, fontWeight: 800,
            opacity: liveMode === "demo" ? 0.4 : 1, cursor: liveMode === "demo" ? "not-allowed" : "pointer",
            border: "1px solid " + (liveMode === "kamp" ? "var(--sx-cyan-bd)" : "var(--sx-border-2)"),
            background: liveMode === "kamp" ? "var(--sx-cyan-bg)" : "transparent",
            color: liveMode === "kamp" ? "var(--sx-cyan)" : "var(--sx-text-2)",
          }}>{liveMode === "kamp" ? "■ 실측 KAMP 정지" : "▶ 실측 KAMP 스트림"}</button>
        <button onClick={startDemo} disabled={liveMode === "kamp"} className="btn subtle"
          style={{
            padding: "6px 12px", fontSize: 11, fontWeight: 800,
            opacity: liveMode === "kamp" ? 0.4 : 1, cursor: liveMode === "kamp" ? "not-allowed" : "pointer",
            border: "1px solid " + (liveMode === "demo" ? "var(--sx-red-bd)" : "var(--sx-border-2)"),
            background: liveMode === "demo" ? "var(--sx-red-bg)" : "transparent",
            color: liveMode === "demo" ? "var(--sx-red-soft)" : "var(--sx-text-2)",
          }}>{liveMode === "demo" ? "■ 데모 정지" : "▶ 데모 스트림"}</button>
        {live && <span className="pill live"><span className="pulse"></span> {liveMode === "kamp" ? "실측 KAMP" : "데모"} · {tick.toLocaleString()}샷</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        <div className={"kpi" + (isDanger ? " red" : sev === 1 ? " cyan" : "")}>
          <div className="lbl">상태</div>
          <div className="val">{statusKo}</div>
          <div className="ci">{live ? "● 실시간 갱신 중" : (r ? "최신 진단 기준" : "—")}</div>
        </div>
        <div className={"kpi" + (isDanger ? " red" : "")}>
          <div className="lbl">복원 오차 (AE)</div>
          <div className="val num">{r ? r.recon_error.toFixed(3) : "—"}<span className="u">/ τ {r ? r.threshold.toFixed(3) : "0.320"}</span></div>
          <div className="ci">{pctThr}% of threshold · 실측</div>
        </div>
        <div className="kpi cyan">
          <div className="lbl">4-AI 합의 투표</div>
          <div className="val num">{r ? r.agree : 0}<span className="u">/ 4 모델</span></div>
          <div className="ci">≥{r?.required ?? 3}/4 → 이상 판정</div>
        </div>
        <div className="kpi">
          <div className="lbl">강도 등급</div>
          <div className="val" style={{ fontSize: 18, marginTop: 12 }}>{statusKo}</div>
          <div className="ci">AE 복원오차 {r ? r.ratio.toFixed(1) : "—"}× τ</div>
        </div>
        <div className={"kpi" + (live ? " red" : "")}>
          <div className="lbl">LIVE 불량률</div>
          <div className="val num">{tick ? ((liveLog.length / tick) * 100).toFixed(1) : "—"}<span className="u">%</span></div>
          <div className="ci">{tick ? `이상 ${liveLog.length} / ${tick}샷${live ? " 누적" : " (정지·세션)"}` : "LIVE 스트리밍 시 집계"}</div>
        </div>
      </div>

      <div className={"banner" + (isDanger ? " danger" : "")} style={!isDanger ? { borderColor: "var(--sx-border)", background: "var(--sx-surface-2)" } : {}}>
        <div className="ico">{isDanger ? "!" : "ⓘ"}</div>
        <div style={{ flex: 1 }}>
          <div className="ttl">{isDanger
            ? `▲ ${statusKo} · 4-AI ${r?.agree ?? 0}/4 합의 이상 감지 — 즉시 조치 필요`
            : `● ${statusKo} · 4-AI 합의 ${r?.agree ?? 0}/4 · 이상 신호 없음`}</div>
          <div className="sub">{r
            ? `복원 오차 ${r.recon_error.toFixed(3)} (임계값 τ ${r.threshold.toFixed(3)}의 ${pctThr}%) · 합의 ${r.agree}/4${isDanger && r.prescriptions[0] ? ` · 주원인 ${r.prescriptions[0].sensor} ${r.prescriptions[0].sigma} · 처방 ${r.prescriptions.length}건` : ""}`
            : "백엔드 연결 대기 중"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: 12, flex: 1, minHeight: 0 }}>
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <div className="card">
            <div className="h">
              <span className="ttl">⚑ 다중 AI 합의 미터 · 4 모델</span>
              <span className="sub">{ens ? `느슨 ≥1/4 FP ${ens.consensus_modes[">=1of4"].fp} → ≥3/4 FP ${ens.consensus_modes[">=3of4"].fp} (거짓경보 ↓)` : "AE·IF·OCSVM·LOF 합의"}</span>
            </div>
            <div className="b">
              <Consensus
                votes={r ? r.votes : [0, 0, 0, 0]}
                scores={r ? r.scores : [0, 0, 0, 0]}
              />
              <div style={{
                marginTop: 14, padding: "10px 12px",
                background: "var(--sx-cyan-bg)", border: "1px dashed var(--sx-cyan-bd)"
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--sx-cyan)", letterSpacing: 0.4 }}>
                  ⓘ 단일 모델 거짓경보 → 4-AI 합의로 해소 (검증 1,379샷 실측)
                </div>
                {ens ? (() => {
                  const u = ens.consensus_modes[">=1of4"], h = ens.consensus_modes[">=3of4"];
                  const drop = u.fp ? Math.round((1 - h.fp / u.fp) * 100) : 0;
                  return (
                    <div style={{ fontSize: 10.5, color: "var(--sx-text-3)", fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>
                      아무 모델이나 1개 발동(≥1/4) 시 거짓경보 {u.fp}건·정밀도 {u.precision.toFixed(2)}. ≥3/4 엄격 합의로 전환하면 거짓경보 {h.fp}건(−{drop}%)·정밀도 {h.precision.toFixed(2)}·재현율 {h.recall.toFixed(2)}. 한 모델이 틀려도 견고.
                    </div>
                  );
                })() : (
                  <div style={{ fontSize: 10.5, color: "var(--sx-text-4)", fontWeight: 600, marginTop: 4 }}>합의 지표 로딩 중…</div>
                )}
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
            <div className="h"><span className="ttl">복원 오차 · 게이지</span><span className="sub">τ {r ? r.threshold.toFixed(3) : "0.320"}</span></div>
            <div className="b">
              <Gauge value={r ? r.recon_error : 0} threshold={r ? r.threshold : 0.320} state={gaugeState} />
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
            <span className="sub">예측: <span className="num" style={{ color: "var(--sx-red-soft)" }}>{wfBefore.toFixed(3)}</span> → <span className="num" style={{ color: wfDelta < 0 ? "var(--sx-cyan)" : "var(--sx-text)" }}>{wfAfter.toFixed(3)}</span> ({wfDelta > 0 ? "+" : ""}{wfDelta}%)</span>
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
            <div style={{ fontSize: 11.5, lineHeight: 1.7, color: "var(--sx-text-2)", fontWeight: 500, minHeight: 60, whiteSpace: "pre-line" }}>
              {nlg ? nlg.text : (nlgLoading ? "보고서 생성 중…" : "분석 대기 중…")}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="h">
            <span className="ttl">이상 감지 이력 · {live ? "LIVE 누적" : "세션"}</span>
            <span className="sub">{live ? `스트리밍 중 · ${liveLog.length}건 — 행 클릭 시 정지·고정` : liveLog.length ? `정지 · ${liveLog.length}건 · 행/드롭다운으로 개별 확인` : "LIVE 시작 시 누적"}</span>
          </div>
          {/* 정지 후 드롭다운 — 기록된 이상 샷을 시간순으로 골라 보기 */}
          {!live && liveLog.length > 0 && (
            <div style={{ padding: "8px 12px", display: "flex", gap: 8, alignItems: "center", borderBottom: "1px solid var(--sx-border)" }}>
              <span className="eyebrow">샷 선택</span>
              <select value={selectedT ?? ""} onChange={(e) => { const en = liveLog.find((x) => x.t === e.target.value); if (en) viewShot(en); }}
                style={{ flex: 1, background: "var(--sx-surface-2)", color: "var(--sx-text)", border: "1px solid var(--sx-border-2)", padding: "5px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                <option value="">시간순 이상 샷 {liveLog.length}건 — 선택해 카드에서 확인</option>
                {[...liveLog].reverse().map((e, i) => (
                  <option key={e.t + i} value={e.t}>{e.t} · {STATUS_KO[e.res.status]} · {e.res.prescriptions[0]?.sensor ?? "—"} · 복원 {e.res.recon_error.toFixed(3)} · {e.res.agree}/4</option>
                ))}
              </select>
            </div>
          )}
          {selectedT && (
            <div style={{ padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--sx-cyan-bg)", borderBottom: "1px solid var(--sx-cyan-bd)" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--sx-cyan)" }}>📌 {selectedT} 샷 고정 보기 중 — 위 카드가 이 샷 기준</span>
              <button onClick={clearSelection} className="btn subtle" style={{ padding: "3px 10px", fontSize: 10.5, fontWeight: 700 }}>✕ 선택 해제</button>
            </div>
          )}
          <div className="b" style={{ padding: 0 }}>
            <table className="tbl">
              <thead><tr><th>시각</th><th>상태</th><th>주센서</th><th>복원오차</th><th>합의</th></tr></thead>
              <tbody>
                {liveLog.slice(0, 8).map((e, i) => {
                  const p0 = e.res.prescriptions[0];
                  const on = e.t === selectedT;
                  return (
                    <tr key={e.t + i} onClick={() => viewShot(e)} style={{ cursor: "pointer", background: on ? "var(--sx-cyan-bg)" : undefined }}>
                      <td className="num">{e.t}</td>
                      <td><span className={"tag" + (e.res.status === "CRITICAL" || e.res.status === "DANGER" ? " red" : "")} style={e.res.status === "WARNING" ? { color: "var(--sx-cyan)" } : {}}>{STATUS_KO[e.res.status]}</span></td>
                      <td>{p0?.sensor ?? "—"} {p0?.sigma ?? ""}</td>
                      <td className="num" style={{ color: "var(--sx-red-soft)" }}>{e.res.recon_error.toFixed(3)}</td>
                      <td className="num">{e.res.agree}/4</td>
                    </tr>
                  );
                })}
                {!liveLog.length && <tr><td colSpan={5} style={{ color: "var(--sx-text-3)", padding: 14, textAlign: "center" }}>{live ? "이상 감지 대기 중…" : "▶ LIVE 스트리밍을 켜면 실시간 누적됩니다"}</td></tr>}
              </tbody>
            </table>
            {liveLog.length > 8 && <div style={{ fontSize: 9.5, color: "var(--sx-text-4)", fontWeight: 600, padding: "4px 12px" }}>표는 최근 8건 · 전체 {liveLog.length}건은 위 드롭다운에서 선택</div>}
          </div>
        </div>
      </div>
    </DashShell>
  );
}
