import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

from src.config import RESULT_DIR, SENSOR_COLS
from src.data_loader import load_labeled_files

os.makedirs(RESULT_DIR, exist_ok=True)

print("=" * 50)
print("EDA: 사출성형기 데이터 탐색")

df = load_labeled_files()
normal = df[df['PassOrFail'] == 0]
defect = df[df['PassOrFail'] == 1]

print(f"\n전체: {len(df)}행")
print(f"정상: {len(normal)} ({len(normal)/len(df)*100:.1f}%)")
print(f"불량: {len(defect)} ({len(defect)/len(df)*100:.1f}%)")

# ── EDA 1: 라벨 분포 파이 차트 ──
fig, ax = plt.subplots(figsize=(5, 5))
ax.pie([len(normal), len(defect)],
       labels=[f'정상\n{len(normal)}건', f'불량\n{len(defect)}건'],
       colors=['steelblue', 'crimson'],
       autopct='%1.1f%%', startangle=90)
ax.set_title('라벨 분포 (PassOrFail)')
plt.tight_layout()
fig.savefig(os.path.join(RESULT_DIR, 'eda_label_dist.png'), dpi=150)
plt.close()

# ── EDA 2: 센서별 정상 vs 불량 분포 (상위 8개) ──
key_sensors = [
    'Injection_Time', 'Cycle_Time', 'Max_Injection_Pressure',
    'Barrel_Temperature_1', 'Barrel_Temperature_3', 'Mold_Temperature_3',
    'Max_Screw_RPM', 'Cushion_Position'
]
fig, axes = plt.subplots(2, 4, figsize=(16, 7))
for ax, col in zip(axes.flatten(), key_sensors):
    ax.hist(normal[col], bins=40, alpha=0.6, color='steelblue', label='정상', density=True)
    ax.hist(defect[col], bins=15, alpha=0.8, color='crimson',   label='불량', density=True)
    ax.set_title(col, fontsize=9)
    ax.legend(fontsize=7)
    ax.grid(True, alpha=0.3)
plt.suptitle('정상 vs 불량 센서값 분포', fontsize=13, y=1.01)
plt.tight_layout()
fig.savefig(os.path.join(RESULT_DIR, 'eda_sensor_dist.png'), dpi=150, bbox_inches='tight')
plt.close()

# ── EDA 3: 상관관계 히트맵 (정상 데이터 기준) ──
fig, ax = plt.subplots(figsize=(14, 11))
corr = normal[SENSOR_COLS].corr()
mask = np.triu(np.ones_like(corr, dtype=bool))
sns.heatmap(corr, mask=mask, annot=False, cmap='coolwarm',
            center=0, linewidths=0.3, ax=ax, cbar_kws={'shrink': 0.7})
ax.set_title('센서 간 상관관계 (정상 데이터)', fontsize=13)
plt.tight_layout()
fig.savefig(os.path.join(RESULT_DIR, 'eda_correlation.png'), dpi=150)
plt.close()

# ── EDA 4: 박스플롯 (정상 vs 불량) ──
fig, ax = plt.subplots(figsize=(14, 5))
plot_data = []
labels = []
for col in key_sensors:
    plot_data.append(normal[col].values)
    labels.append(f'{col}\n(정상)')
bp = ax.boxplot(plot_data, patch_artist=True,
                boxprops=dict(facecolor='steelblue', alpha=0.6))
ax.set_xticks(range(1, len(key_sensors)+1))
ax.set_xticklabels([c.replace('_', '\n') for c in key_sensors], fontsize=8)
ax.set_title('주요 센서 분포 (정상 기준 박스플롯)', fontsize=12)
ax.grid(True, alpha=0.3, axis='y')
plt.tight_layout()
fig.savefig(os.path.join(RESULT_DIR, 'eda_boxplot.png'), dpi=150)
plt.close()

# ── EDA 5: 기술통계 CSV 저장 ──
stats = pd.DataFrame({
    '정상_mean': normal[SENSOR_COLS].mean(),
    '정상_std':  normal[SENSOR_COLS].std(),
    '불량_mean': defect[SENSOR_COLS].mean(),
    '불량_std':  defect[SENSOR_COLS].std(),
})
stats['평균차이(불량-정상)'] = stats['불량_mean'] - stats['정상_mean']
stats['차이비율(%)'] = (stats['평균차이(불량-정상)'] / (stats['정상_mean'].abs() + 1e-9) * 100).round(2)
stats = stats.round(4)
stats.to_csv(os.path.join(RESULT_DIR, 'eda_stats.csv'), encoding='utf-8-sig')

print("\n=== 정상 vs 불량 평균 차이 Top 5 ===")
print(stats['차이비율(%)'].abs().sort_values(ascending=False).head(5))

print(f"\nEDA 결과 저장:")
print("  results/eda_label_dist.png")
print("  results/eda_sensor_dist.png")
print("  results/eda_correlation.png")
print("  results/eda_boxplot.png")
print("  results/eda_stats.csv")
print("완료!")
