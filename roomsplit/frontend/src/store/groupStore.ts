import { create } from 'zustand'

interface GroupState {
  groupId: string | null
  setGroupId: (id: string) => void
  clearGroupId: () => void
}

export const useGroupStore = create<GroupState>((set) => ({
  groupId: null,
  setGroupId: (groupId) => set({ groupId }),
  clearGroupId: () => set({ groupId: null }),
}))
