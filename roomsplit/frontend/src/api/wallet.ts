import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { Wallet, WalletTransaction, Withdrawal } from '@/types/wallet'
import { PaginatedResponse } from '@/types/common'

interface TransactionParams {
  page?: number
  page_size?: number
  type?: string
  date_from?: string
  date_to?: string
}

// Get wallet balance for a group
export function useWallet(groupId: string) {
  return useQuery({
    queryKey: ['wallet', groupId],
    queryFn: async () => {
      const { data } = await api.get<Wallet>(`/groups/${groupId}/wallet`)
      return data
    },
    enabled: !!groupId,
  })
}

// Get wallet transactions
export function useWalletTransactions(groupId: string, params?: TransactionParams) {
  return useQuery({
    queryKey: ['wallet-transactions', groupId, params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<WalletTransaction>>(
        `/groups/${groupId}/wallet/transactions`,
        { params }
      )
      return data
    },
    enabled: !!groupId,
  })
}

// Get withdrawals
export function useWithdrawals(groupId: string) {
  return useQuery({
    queryKey: ['withdrawals', groupId],
    queryFn: async () => {
      const { data } = await api.get<Withdrawal[]>(`/groups/${groupId}/withdrawals`)
      return data
    },
    enabled: !!groupId,
  })
}

// Request withdrawal
export function useMutateRequestWithdrawal(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      amount: number  // rupees — backend converts to paise; destination_upi taken from user profile
      reason?: string
    }) => {
      const { data } = await api.post<Withdrawal>(
        `/groups/${groupId}/withdrawals`,
        payload
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['withdrawals', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['wallet', groupId] })
    },
  })
}

// Approve withdrawal
export function useMutateApproveWithdrawal(groupId: string, withdrawalId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Withdrawal>(
        `/groups/${groupId}/withdrawals/${withdrawalId}/approve`
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['withdrawals', groupId] })
    },
  })
}

// Complete withdrawal
export function useMutateCompleteWithdrawal(groupId: string, withdrawalId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { upi_ref: string }) => {
      const { data } = await api.post<Withdrawal>(
        `/groups/${groupId}/withdrawals/${withdrawalId}/complete`,
        payload
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['withdrawals', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['wallet', groupId] })
    },
  })
}
