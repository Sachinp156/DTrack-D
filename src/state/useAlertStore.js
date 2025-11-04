import { create } from 'zustand';

export const useAlertStore = create((set, get) => ({
  current: null,
  queue: [],
  push: (a) => {
    const item = { id: `${Date.now()}-${Math.random()}`, durationMs: 4000, ...a };
    const { current, queue } = get();
    if (!current) set({ current: item });
    else set({ queue: [...queue, item] });
  },
  pop: () => {
    const { queue } = get();
    set({ current: queue[0] ?? null, queue: queue.slice(1) });
  },
  clear: () => set({ current: null, queue: [] }),
}));
