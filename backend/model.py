"""Autoencoder 정의 — src/model.py와 동일 아키텍처 (배포용 self-contained, matplotlib 의존 없음)."""
import torch
import torch.nn as nn


class Autoencoder(nn.Module):
    def __init__(self, input_dim=24):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 16),
            nn.BatchNorm1d(16),
            nn.ReLU(),
            nn.Linear(16, 8),
            nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(8, 16),
            nn.BatchNorm1d(16),
            nn.ReLU(),
            nn.Linear(16, input_dim),
        )

    def forward(self, x):
        return self.decoder(self.encoder(x))


def recon_error(model: nn.Module, X: torch.Tensor) -> torch.Tensor:
    """각 샘플의 MSE 복원 오차. BatchNorm 안전을 위해 eval 모드 가정."""
    with torch.no_grad():
        X_hat = model(X)
    return torch.mean((X - X_hat) ** 2, dim=1)
