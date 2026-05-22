/* SmartFactory XAI — 백엔드 API 클라이언트
   기본 베이스: NEXT_PUBLIC_API_URL (없으면 로컬 127.0.0.1:8100) */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8100";

/* 학습 순서 고정 24 센서 (backend SENSOR_COLS와 동일) */
export const SENSOR_COLS = [
  "Injection_Time", "Filling_Time", "Plasticizing_Time", "Cycle_Time",
  "Clamp_Close_Time", "Cushion_Position", "Plasticizing_Position",
  "Clamp_Open_Position", "Max_Injection_Speed", "Max_Screw_RPM",
  "Average_Screw_RPM", "Max_Injection_Pressure", "Max_Switch_Over_Pressure",
  "Max_Back_Pressure", "Average_Back_Pressure",
  "Barrel_Temperature_1", "Barrel_Temperature_2", "Barrel_Temperature_3",
  "Barrel_Temperature_4", "Barrel_Temperature_5", "Barrel_Temperature_6",
  "Hopper_Temperature", "Mold_Temperature_3", "Mold_Temperature_4",
];

export interface SensorRow {
  name: string; sigma: number; pos: number; hot: boolean; warm: boolean;
}
export interface SensorGroup { group: string; rows: SensorRow[]; }
export interface Prescription { sensor: string; sigma: string; action: string; }

export interface PredictResult {
  recon_error: number; threshold: number; ratio: number;
  status: "NORMAL" | "WARNING" | "DANGER" | "CRITICAL"; severity: number;
  votes: number[]; scores: number[];
  agree: number; total: number; required: number; soft: number;
  sensor_groups: SensorGroup[]; prescriptions: Prescription[];
}

export interface Scenario { name: string; z: number[]; }

export interface ShapTop { name: string; shap: number; abs_shap: number; sigma: string; }
export interface ExplainResult {
  top: ShapTop[]; cumulative: number; n_features: number;
  base?: number; pred?: number; rest?: number; rest_n?: number;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

export interface MetricsBundle {
  metrics: any; ensemble: any; soft_voting: any; stacking: any;
  baseline: any; cost_threshold: any; hypothesis_test: any;
}
export interface BatchBundle { metrics: any; anomaly_log: any; }

/* 크로스탭 시나리오 컨텍스트 — 한 탭/사이드바에서 고른 운전상태가 플랫폼 전체에 흐름 (pub/sub) */
type ScenListener = (i: number) => void;
const _scenListeners = new Set<ScenListener>();
export const scenarioStore = {
  get(): number | null {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem("sfx_scenario");
    return v === null ? null : Number(v);
  },
  set(i: number) {
    if (typeof window !== "undefined") window.localStorage.setItem("sfx_scenario", String(i));
    _scenListeners.forEach((l) => l(i));
  },
  subscribe(l: ScenListener) { _scenListeners.add(l); return () => { _scenListeners.delete(l); }; },
};

/* 라이브 이상 이력 — 탭 이동해도 보존(모듈 전역 + pub/sub) */
export interface LiveEntry { t: string; z: number[]; res: PredictResult; }
let _liveLog: LiveEntry[] = [];
let _liveTick = 0;
const _liveListeners = new Set<() => void>();
export const liveStore = {
  state(): { log: LiveEntry[]; tick: number } { return { log: _liveLog, tick: _liveTick }; },
  bump(e?: LiveEntry) { _liveTick++; if (e) _liveLog = [e, ..._liveLog].slice(0, 50); _liveListeners.forEach((l) => l()); },
  reset() { _liveLog = []; _liveTick = 0; _liveListeners.forEach((l) => l()); },
  subscribe(l: () => void) { _liveListeners.add(l); return () => { _liveListeners.delete(l); }; },
};

/* 원인분석(Tab2) 대상 z — 라이브 샷을 SHAP 분석으로 보낼 때 사용 */
let _analysisZ: number[] | null = null;
let _analysisName = "";
const _aListeners = new Set<() => void>();
export const analysisStore = {
  get(): { z: number[] | null; name: string } { return { z: _analysisZ, name: _analysisName }; },
  set(z: number[], name: string) { _analysisZ = z; _analysisName = name; _aListeners.forEach((l) => l()); },
  clear() { _analysisZ = null; _analysisName = ""; _aListeners.forEach((l) => l()); },
  subscribe(l: () => void) { _aListeners.add(l); return () => { _aListeners.delete(l); }; },
};

export const api = {
  predict: (z: number[], required_votes = 3) =>
    post<PredictResult>("/api/predict", { z, required_votes }),
  explain: (z: number[], top_n = 5) =>
    post<ExplainResult>("/api/explain", { z, top_n }),
  report: (z: number[], tone: "worker" | "supervisor" | "director" = "worker") =>
    post<{ text: string; model: string; cached: boolean }>("/api/report", { z, tone }),
  scenarios: () => get<{ scenarios: Scenario[] }>("/api/scenarios"),
  health: () => get<{ status: string; threshold: number; sensors: number }>("/api/health"),
  metrics: () => get<MetricsBundle>("/api/metrics"),
  batch: () => get<BatchBundle>("/api/batch"),
  pca: () => get<any>("/api/pca"),
  causal: () => get<any>("/api/causal"),
  validation: () => get<{ errors: number[]; labels: number[]; n: number; n_defect: number; err_min: number; err_max: number; note: string }>("/api/validation"),
  shots: () => get<{ shots: number[][]; labels: number[]; n: number; n_defect: number }>("/api/shots"),
  improve: () => post<ImproveResult>("/api/improve", {}),
};

export interface ImproveResult {
  recommendation: string; approach: string; rationale: string; model: string;
  files: { name: string; kind: string; content: string }[];
}
