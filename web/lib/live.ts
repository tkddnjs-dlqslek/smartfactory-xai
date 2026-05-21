"use client";
/* LIVE 스트리밍 on/off 공유 상태 — Sidebar 토글과 Tab1 스트리밍이 같이 반응 */
type Listener = (on: boolean) => void;
let _on = false;
const listeners = new Set<Listener>();

export const liveStore = {
  get: () => _on,
  set: (v: boolean) => { _on = v; listeners.forEach((l) => l(_on)); },
  toggle: () => liveStore.set(!_on),
  subscribe: (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; },
};
