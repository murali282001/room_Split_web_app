import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { RentCycle, RentAssignment, Payment } from '@/types/payment'
import { PaginatedResponse } from '@/types/common'

interface CycleParams {
  page?: number
  page_size?: number
  status?: string
}

// List cycles for a group
export function useCycles(groupId: string, params?: CycleParams) {
  return useQuery({
    queryKey: ['cycles', groupId, params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<RentCycle>>(`/groups/${groupId}/cycles`, {
        params,
      })
      return data
    },
    enabled: !!groupId,
  })
}

// Get single cycle
export function useCycle(groupId: string, cycleId: string) {
  return useQuery({
    queryKey: ['cycle', groupId, cycleId],
    queryFn: async () => {
      const { data } = await api.get<RentCycle>(`/groups/${groupId}/cycles/${cycleId}`)
      return data
    },
    enabled: !!groupId && !!cycleId,
  })
}

// Create cycle
export function useMutateCreateCycle(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      label: string
      period_start: string
      period_end: string
      total_amount: number
      due_date: string
      notes?: string
    }) => {
      const { data } = await api.post<RentCycle>(`/groups/${groupId}/cycles`, payload)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cycles', groupId] })
    },
  })
}

// Update cycle
export function useMutateUpdateCycle(groupId: string, cycleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RentCycle>) => {
      const { data } = await api.put<RentCycle>(`/groups/${groupId}/cycles/${cycleId}`, payload)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cycle', groupId, cycleId] })
      void queryClient.invalidateQueries({ queryKey: ['cycles', groupId] })
    },
  })
}

// Activate cycle
export function useMutateActivateCycle(groupId: string, cycleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<RentCycle>(`/groups/${groupId}/cycles/${cycleId}/activate`)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cycle', groupId, cycleId] })
      void queryClient.invalidateQueries({ queryKey: ['cycles', groupId] })
    },
  })
}

// Close cycle
export function useMutateCloseCycle(groupId: string, cycleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<RentCycle>(`/groups/${groupId}/cycles/${cycleId}/close`)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cycle', groupId, cycleId] })
      void queryClient.invalidateQueries({ queryKey: ['cycles', groupId] })
    },
  })
}

// Get cycle assignments
export function useCycleAssignments(groupId: string, cycleId: string) {
  return useQuery({
    queryKey: ['cycle-assignments', groupId, cycleId],
    queryFn: async () => {
      const { data } = await api.get<RentAssignment[]>(
        `/groups/${groupId}/cycles/${cycleId}/assignments`
      )
      return data
    },
    enabled: !!groupId && !!cycleId,
  })
}

// Get cycle payments
export function useCyclePayments(groupId: string, cycleId: string) {
  return useQuery({
    queryKey: ['cycle-payments', groupId, cycleId],
    queryFn: async () => {
      const { data } = await api.get<Payment[]>(`/groups/${groupId}/cycles/${cycleId}/payments`)
      return data
    },
    enabled: !!groupId && !!cycleId,
  })
}
