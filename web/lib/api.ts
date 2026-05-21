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
export interface ExplainResult { top: ShapTop[]; cumulative: number; n_features: number; }

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

export const api = {
  predict: (z: number[], required_votes = 3) =>
    post<PredictResult>("/api/predict", { z, required_votes }),
  explain: (z: number[], top_n = 5) =>
    post<ExplainResult>("/api/explain", { z, top_n }),
  scenarios: () => get<{ scenarios: Scenario[] }>("/api/scenarios"),
  health: () => get<{ status: string; threshold: number; sensors: number }>("/api/health"),
  metrics: () => get<MetricsBundle>("/api/metrics"),
  batch: () => get<BatchBundle>("/api/batch"),
};
