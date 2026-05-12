import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from src.config import BATCH_SIZE, EPOCHS, LR, EARLY_STOP_PATIENCE, SEED


def train(model, X_train: np.ndarray, X_val_normal: np.ndarray):
    torch.manual_seed(SEED)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    criterion = nn.MSELoss()

    X_t = torch.FloatTensor(X_train)
    X_v = torch.FloatTensor(X_val_normal)

    loader = DataLoader(TensorDataset(X_t, X_t),
                        batch_size=BATCH_SIZE, shuffle=True)

    best_val_loss = float('inf')
    patience_cnt = 0
    history = {'train_loss': [], 'val_loss': []}

    for epoch in range(1, EPOCHS + 1):
        model.train()
        train_losses = []
        for xb, _ in loader:
            optimizer.zero_grad()
            loss = criterion(model(xb), xb)
            loss.backward()
            optimizer.step()
            train_losses.append(loss.item())

        model.eval()
        with torch.no_grad():
            val_loss = criterion(model(X_v), X_v).item()

        t_loss = np.mean(train_losses)
        history['train_loss'].append(t_loss)
        history['val_loss'].append(val_loss)

        if epoch % 10 == 0:
            print(f"Epoch {epoch:3d} | train={t_loss:.6f} | val={val_loss:.6f}")

        if val_loss < best_val_loss - 1e-6:
            best_val_loss = val_loss
            patience_cnt = 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            patience_cnt += 1
            if patience_cnt >= EARLY_STOP_PATIENCE:
                print(f"Early stop at epoch {epoch}")
                break

    model.load_state_dict(best_state)
    return history
