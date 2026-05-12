"""
모델 파일 무결성 검증 스크립트 (PC-C2 — model poisoning 방어)

사용법:
  python scripts/verify_model.py --record   # 최초 배포 시 해시 기록
  python scripts/verify_model.py            # 실행 전 해시 검증

해시는 models/model_integrity.json 에 기록됨.
"""
import sys, os, json, hashlib, argparse
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, 'models')
INTEGRITY_FILE = os.path.join(MODEL_DIR, 'model_integrity.json')

WATCHED_FILES = ['autoencoder.pt', 'scaler.pkl', 'threshold.json']


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def record_hashes():
    record = {}
    for fname in WATCHED_FILES:
        fpath = os.path.join(MODEL_DIR, fname)
        if not os.path.exists(fpath):
            print(f"[경고] {fname} 없음 - skip")
            continue
        record[fname] = {
            'sha256': sha256_of(fpath),
            'size': os.path.getsize(fpath),
        }
        print(f"[기록] {fname}: {record[fname]['sha256'][:16]}...")
    with open(INTEGRITY_FILE, 'w', encoding='utf-8') as f:
        json.dump(record, f, indent=2)
    print(f"\n무결성 해시 기록 완료: {INTEGRITY_FILE}")


def verify_hashes():
    if not os.path.exists(INTEGRITY_FILE):
        print(f"[경고] {INTEGRITY_FILE} 없음. 최초 기록 필요:")
        print(f"  python scripts/verify_model.py --record")
        return False
    with open(INTEGRITY_FILE, encoding='utf-8') as f:
        record = json.load(f)
    all_ok = True
    for fname in WATCHED_FILES:
        fpath = os.path.join(MODEL_DIR, fname)
        if not os.path.exists(fpath):
            print(f"[FAIL] {fname} 파일 없음")
            all_ok = False
            continue
        if fname not in record:
            print(f"[SKIP] {fname} 기록되지 않음 - --record 재실행 권장")
            continue
        cur_hash = sha256_of(fpath)
        if cur_hash == record[fname]['sha256']:
            print(f"[OK]   {fname}: 무결성 검증 통과")
        else:
            print(f"[FAIL] {fname}: 해시 불일치 - 파일이 변경됨!")
            print(f"       기록: {record[fname]['sha256'][:32]}...")
            print(f"       현재: {cur_hash[:32]}...")
            all_ok = False
    return all_ok


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--record', action='store_true', help='해시 기록 (최초 배포 시)')
    args = p.parse_args()

    if args.record:
        record_hashes()
        sys.exit(0)
    else:
        ok = verify_hashes()
        sys.exit(0 if ok else 1)
