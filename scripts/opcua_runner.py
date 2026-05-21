"""
OPC-UA 모의 스트림 - 본선 시연용 (P1)

구조:
  ┌─ OPC-UA Server (asyncua, opc.tcp://localhost:4840) ─┐
  │  • Namespace: ns=2;s=SmartFactory                   │
  │  • 24개 센서 노드 (Injection_Time, Filling_Time ...) │
  │  • 검증셋 1,379건을 INTERVAL 초마다 순차 publish      │
  └─────────────────────────────────────────────────────┘
              ↓
  ┌─ OPC-UA Client (asyncua) ─────────────────────────────┐
  │  • 24 노드 폴링                                        │
  │  • models/opcua_live.json 에 매 update 마다 덮어쓰기    │
  └───────────────────────────────────────────────────────┘
              ↓ JSON 파일 (1초마다 갱신)
  ┌─ Streamlit Dashboard ─────────────────────────────────┐
  │  • 사이드바 "OPC-UA 모드 ON" 토글                       │
  │  • opcua_live.json 읽어서 24 슬라이더 자동 입력          │
  └───────────────────────────────────────────────────────┘

본선 시연 시:
  Terminal 1: python scripts/opcua_runner.py  ← OPC-UA 서버+클라이언트 동시 실행
  Terminal 2: streamlit run app.py            ← 대시보드
  → 평가위원 앞에서 "사출성형기 시뮬레이터 → OPC-UA → AI" 흐름 시연
"""
import sys, os, json, asyncio, signal
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Windows cp949 콘솔 호환
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

import numpy as np
from asyncua import Server, ua, Client

from src.config import MODEL_DIR, SENSOR_COLS

# ── 설정 ──
OPCUA_ENDPOINT = "opc.tcp://localhost:4840/smartfactory/server/"
NAMESPACE_URI = "http://smartfactory-xai/sensors"
INTERVAL_SEC = 2.0  # 검증셋 1샷 publish 간격 (실제 사출 사이클 ~30s, 시연 단축)
LIVE_FILE = os.path.join(MODEL_DIR, "opcua_live.json")

# ──────────────────────────────────────────────────────────
# OPC-UA 서버: 24센서 노드 publish
# ──────────────────────────────────────────────────────────
async def run_server(stop_event):
    server = Server()
    await server.init()
    server.set_endpoint(OPCUA_ENDPOINT)
    server.set_server_name("SmartFactory XAI - Injection Molding OPC-UA")

    idx = await server.register_namespace(NAMESPACE_URI)

    # 24센서 노드 생성 (Float 타입)
    machine = await server.nodes.objects.add_object(idx, "SmartFactory_M1")
    nodes = {}
    for col in SENSOR_COLS:
        v = await machine.add_variable(idx, col, 0.0)
        await v.set_writable()
        nodes[col] = v

    # shot_id 카운터 + timestamp
    shot_id_var = await machine.add_variable(idx, "ShotID", 0)
    await shot_id_var.set_writable()
    timestamp_var = await machine.add_variable(idx, "Timestamp", "")
    await timestamp_var.set_writable()

    # 검증셋 데이터 로드 (z-score → raw 변환)
    import joblib
    X_val = np.load(os.path.join(MODEL_DIR, "X_val.npy"))
    y_val = np.load(os.path.join(MODEL_DIR, "y_val.npy"))
    scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
    mu, sd = scaler.mean_, scaler.scale_

    # 셔플 (재현성 있는 seed) - y_val 순서가 raw 라 정상→불량 연속 방지
    rng = np.random.RandomState(42)
    order = rng.permutation(len(X_val))
    X_shuffled = X_val[order]
    y_shuffled = y_val[order]
    N = len(X_shuffled)

    async with server:
        print(f"[OPC-UA 서버] {OPCUA_ENDPOINT}")
        print(f"[OPC-UA 서버] 네임스페이스 idx={idx}, URI={NAMESPACE_URI}")
        print(f"[OPC-UA 서버] 24센서 노드 publish 시작 - 검증셋 {N}샷, {INTERVAL_SEC}s 간격")

        import datetime
        i = 0
        while not stop_event.is_set():
            z = X_shuffled[i % N]
            true_label = int(y_shuffled[i % N])
            # z-score → raw
            raw = mu + z * sd
            now_iso = datetime.datetime.now().isoformat(timespec="seconds")

            # 노드 일괄 업데이트
            for k, col in enumerate(SENSOR_COLS):
                await nodes[col].write_value(float(raw[k]))
            await shot_id_var.write_value(int(i + 1))
            await timestamp_var.write_value(now_iso)

            label_text = " (UNLABELED)" if true_label == 0 else " ⚠ DEFECT (실측 불량)"
            print(f"  [{i+1:4d}/{N}] shot publish · {now_iso}{label_text}")
            i += 1
            await asyncio.sleep(INTERVAL_SEC)


# ──────────────────────────────────────────────────────────
# OPC-UA 클라이언트: 서버에서 24센서 값 읽어 JSON 저장
# ──────────────────────────────────────────────────────────
async def run_client(stop_event):
    # 서버 기동 대기
    await asyncio.sleep(2.0)

    async with Client(url=OPCUA_ENDPOINT) as client:
        nsidx = await client.get_namespace_index(NAMESPACE_URI)
        print(f"[OPC-UA 클라이언트] 서버 연결 OK, ns={nsidx}")

        # 노드 핸들 캐시
        node_map = {}
        objects = await client.nodes.objects.get_children()
        for o in objects:
            name = await o.read_browse_name()
            if "SmartFactory_M1" in str(name):
                for v in await o.get_children():
                    vname = (await v.read_browse_name()).Name
                    node_map[vname] = v
                break

        if not node_map:
            print("[OPC-UA 클라이언트] ❌ SmartFactory_M1 노드 발견 실패")
            return

        print(f"[OPC-UA 클라이언트] 노드 {len(node_map)}개 발견, JSON 폴링 시작")

        while not stop_event.is_set():
            try:
                snapshot = {}
                for col in SENSOR_COLS:
                    if col in node_map:
                        snapshot[col] = float(await node_map[col].read_value())
                snapshot["shot_id"]   = int(await node_map["ShotID"].read_value()) if "ShotID" in node_map else 0
                snapshot["timestamp"] = str(await node_map["Timestamp"].read_value()) if "Timestamp" in node_map else ""
                # 원자적 쓰기
                tmp = LIVE_FILE + ".tmp"
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(snapshot, f, indent=2, ensure_ascii=False)
                os.replace(tmp, LIVE_FILE)
            except Exception as e:
                print(f"  [클라이언트 오류] {e}")
            await asyncio.sleep(1.0)


# ──────────────────────────────────────────────────────────
# 메인 - 서버 + 클라이언트 동시 실행
# ──────────────────────────────────────────────────────────
async def main():
    stop = asyncio.Event()

    def shutdown(*a):
        print("\n[중지 신호 수신] OPC-UA 종료 중...")
        stop.set()

    # Windows에서 Ctrl+C 처리
    try:
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, shutdown)
            except NotImplementedError:
                pass  # Windows: signal_handler 미지원
    except Exception:
        pass

    server_task = asyncio.create_task(run_server(stop))
    client_task = asyncio.create_task(run_client(stop))

    try:
        await asyncio.gather(server_task, client_task)
    except (KeyboardInterrupt, asyncio.CancelledError):
        shutdown()
        await asyncio.sleep(0.5)


if __name__ == "__main__":
    print("=" * 60)
    print("  SmartFactory XAI - OPC-UA 모의 스트림 (P1)")
    print("  endpoint:", OPCUA_ENDPOINT)
    print("  JSON 출력:", LIVE_FILE)
    print("  중지: Ctrl+C")
    print("=" * 60)
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[종료] OPC-UA 모의 스트림 중지됨")
