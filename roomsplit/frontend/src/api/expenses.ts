import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { Expense } from '@/types/expense'
import { PaginatedResponse } from '@/types/common'

interface ExpenseParams {
  page?: number
  page_size?: number
  status?: string
  category?: string
  date_from?: string
  date_to?: string
}

// List expenses for a group
export function useExpenses(groupId: string, params?: ExpenseParams) {
  return useQuery({
    queryKey: ['expenses', groupId, params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Expense>>(`/groups/${groupId}/expenses`, {
        params,
      })
      return data
    },
    enabled: !!groupId,
  })
}

// Get single expense
export function useExpense(groupId: string, expenseId: string) {
  return useQuery({
    queryKey: ['expense', groupId, expenseId],
    queryFn: async () => {
      const { data } = await api.get<Expense>(`/groups/${groupId}/expenses/${expenseId}`)
      return data
    },
    enabled: !!groupId && !!expenseId,
  })
}

// Create expense
export function useMutateCreateExpense(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      title: string
      category?: string
      total_amount: number
      split_type: 'equal' | 'custom'
      expense_date: string
      members?: Array<{ member_id: string; amount: number }>
    }) => {
      const { data } = await api.post<Expense>(`/groups/${groupId}/expenses`, payload)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses', groupId] })
    },
  })
}

// Delete expense
export function useMutateDeleteExpense(groupId: string, expenseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/groups/${groupId}/expenses/${expenseId}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses', groupId] })
    },
  })
}
