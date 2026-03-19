import { create } from 'zustand'

interface NotificationState {
  unreadCount: number
  setUnreadCount: (n: number) => void
  decrement: () => void
  increment: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
  decrement: () => set({ unreadCount: Math.max(0, get().unreadCount - 1) }),
  increment: () => set({ unreadCount: get().unreadCount + 1 }),
}))
