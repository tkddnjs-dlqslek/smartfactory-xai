import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
from src.config import DATA_DIR, MODEL_DIR, SENSOR_COLS, SEED


def load_labeled_files():
    """z-score 완료된 라벨 파일 3개 통합 로드"""
    files = [
        'supervised_label_cn7.csv',
        'moldset_labeled_cn7.csv',
        'moldset_labeled_rg3.csv',
    ]
    dfs = []
    for f in files:
        path = os.path.join(DATA_DIR, f)
        df = pd.read_csv(path, index_col=0)
        df = df[SENSOR_COLS + ['PassOrFail']].copy()
        df['source'] = f
        dfs.append(df)
    return pd.concat(dfs, ignore_index=True)


def fit_scaler_from_raw():
    """raw 파일에서 StandardScaler fit 후 저장"""
    raw_files = ['moldset_labeled.csv']
    dfs = []
    for f in raw_files:
        path = os.path.join(DATA_DIR, f)
        df = pd.read_csv(path, index_col=0, encoding='cp949')
        available = [c for c in SENSOR_COLS if c in df.columns]
        dfs.append(df[available].dropna())

    raw_df = pd.concat(dfs, ignore_index=True)
    scaler = StandardScaler()
    scaler.fit(raw_df[SENSOR_COLS])
    joblib.dump(scaler, os.path.join(MODEL_DIR, 'scaler.pkl'))
    print(f"Scaler fit on {len(raw_df)} raw rows → models/scaler.pkl")
    return scaler


def load_scaler():
    path = os.path.join(MODEL_DIR, 'scaler.pkl')
    if not os.path.exists(path):
        return fit_scaler_from_raw()
    return joblib.load(path)


def prepare_train_val(df):
    """
    정상 데이터로 train/val 분리.
    StandardScaler 정규화 적용 후 반환.
    val에는 불량 전체 포함.
    """
    normal = df[df['PassOrFail'] == 0][SENSOR_COLS]
    defect = df[df['PassOrFail'] == 1][SENSOR_COLS]

    X_train_raw, X_val_normal_raw = train_test_split(
        normal, test_size=0.2, random_state=SEED
    )

    # 정상 train 데이터로만 scaler fit
    scaler = StandardScaler()
    scaler.fit(X_train_raw)
    joblib.dump(scaler, os.path.join(MODEL_DIR, 'scaler.pkl'))
    print(f"Scaler fit & saved → models/scaler.pkl")

    X_train = scaler.transform(X_train_raw).astype(np.float32)
    X_val_normal = scaler.transform(X_val_normal_raw).astype(np.float32)
    X_defect = scaler.transform(defect).astype(np.float32)

    X_val = np.concatenate([X_val_normal, X_defect], axis=0)
    y_val = np.array([0] * len(X_val_normal) + [1] * len(X_defect))

    print(f"Train  : {len(X_train)} 정상")
    print(f"Val    : {len(X_val_normal)} 정상 + {len(X_defect)} 불량")
    return X_train, X_val, y_val


def load_unlabeled_chunks(chunk_size=10000):
    """795K 비라벨 데이터 청크 제너레이터"""
    path = os.path.join(DATA_DIR, 'unlabeled_data.csv')
    for chunk in pd.read_csv(path, chunksize=chunk_size,
                              index_col=0, low_memory=False):
        available = [c for c in SENSOR_COLS if c in chunk.columns]
        meta_cols = [c for c in ['ERR_FACT_QTY', 'TimeStamp', 'EQUIP_NAME', 'PART_NAME']
                     if c in chunk.columns]
        yield chunk[available].copy(), chunk[meta_cols].copy() if meta_cols else pd.DataFrame()
