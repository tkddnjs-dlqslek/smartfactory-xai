import os
import matplotlib
import matplotlib.pyplot as plt

# 한글 폰트 설정
matplotlib.rc('font', family='Malgun Gothic')
matplotlib.rc('axes', unicode_minus=False)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, '..', 'dataset')
MODEL_DIR = os.path.join(BASE_DIR, 'models')
RESULT_DIR = os.path.join(BASE_DIR, 'results')

for d in [MODEL_DIR, RESULT_DIR]:
    os.makedirs(d, exist_ok=True)

SENSOR_COLS = [
    'Injection_Time', 'Filling_Time', 'Plasticizing_Time', 'Cycle_Time',
    'Clamp_Close_Time', 'Cushion_Position', 'Plasticizing_Position',
    'Clamp_Open_Position', 'Max_Injection_Speed', 'Max_Screw_RPM',
    'Average_Screw_RPM', 'Max_Injection_Pressure', 'Max_Switch_Over_Pressure',
    'Max_Back_Pressure', 'Average_Back_Pressure',
    'Barrel_Temperature_1', 'Barrel_Temperature_2', 'Barrel_Temperature_3',
    'Barrel_Temperature_4', 'Barrel_Temperature_5', 'Barrel_Temperature_6',
    'Hopper_Temperature', 'Mold_Temperature_3', 'Mold_Temperature_4'
]

# 오토인코더 하이퍼파라미터
HIDDEN_DIMS = [16, 8]
LATENT_DIM = 8
BATCH_SIZE = 256
EPOCHS = 100
LR = 0.001
EARLY_STOP_PATIENCE = 10
THRESHOLD_PERCENTILE = 99

# 랜덤 시드
SEED = 42
