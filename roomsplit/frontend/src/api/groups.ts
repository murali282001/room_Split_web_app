import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { Group, Member, Role } from '@/types/group'

// List all groups for current user
export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await api.get<Group[]>('/groups')
      return data
    },
  })
}

// Get single group
export function useGroup(groupId: string) {
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data } = await api.get<Group>(`/groups/${groupId}`)
      return data
    },
    enabled: !!groupId,
  })
}

// Create group
export function useMutateCreateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      description?: string
      rent_collection_upi: string
      cycle_type: string
      cycle_day?: number
    }) => {
      const { data } = await api.post<Group>('/groups', payload)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

// Delete group
export function useMutateDeleteGroup(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/groups/${groupId}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.removeQueries({ queryKey: ['group', groupId] })
    },
  })
}

// Update group
export function useMutateUpdateGroup(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Group>) => {
      const { data } = await api.put<Group>(`/groups/${groupId}`, payload)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

// Join group via invite code
export function useMutateJoinGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (invite_code: string) => {
      const { data } = await api.post<Group>('/groups/join', { invite_code })
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

// Refresh invite code
export function useMutateRefreshInvite(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ invite_code: string }>(`/groups/${groupId}/invite`)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] })
    },
  })
}

// List members of a group
export function useMembers(groupId: string) {
  return useQuery({
    queryKey: ['members', groupId],
    queryFn: async () => {
      const { data } = await api.get<Member[]>(`/groups/${groupId}/members`)
      return data
    },
    enabled: !!groupId,
  })
}

// List roles of a group
export function useRoles(groupId: string) {
  return useQuery({
    queryKey: ['roles', groupId],
    queryFn: async () => {
      const { data } = await api.get<Role[]>(`/groups/${groupId}/roles`)
      return data
    },
    enabled: !!groupId,
  })
}

// Assign role to member
export function useMutateAssignRole(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const { data } = await api.post(`/groups/${groupId}/members/${userId}/role`, { role_id: roleId })
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', groupId] })
    },
  })
}

// Remove member from group
export function useMutateRemoveMember(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/groups/${groupId}/members/${userId}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', groupId] })
    },
  })
}

// Create custom role
export function useMutateCreateRole(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; permissions: Record<string, boolean> }) => {
      const { data } = await api.post<Role>(`/groups/${groupId}/roles`, payload)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles', groupId] })
    },
  })
}

// Update role
export function useMutateUpdateRole(groupId: string, roleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name?: string; permissions?: Record<string, boolean> }) => {
      const { data } = await api.put<Role>(`/groups/${groupId}/roles/${roleId}`, payload)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles', groupId] })
    },
  })
}

// Delete role
export function useMutateDeleteRole(groupId: string, roleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/groups/${groupId}/roles/${roleId}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles', groupId] })
    },
  })
}
