import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { Payment, UPILinkResponse } from '@/types/payment'
import { PaginatedResponse } from '@/types/common'

interface PaymentsParams {
  page?: number
  page_size?: number
  status?: string
  member_id?: string
  date_from?: string
  date_to?: string
  payment_type?: string
}

// List payments for a group
export function usePayments(groupId: string, params?: PaymentsParams) {
  return useQuery({
    queryKey: ['payments', groupId, params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Payment>>(`/groups/${groupId}/payments`, {
        params,
      })
      return data
    },
    enabled: !!groupId,
  })
}

// Get single payment
export function usePayment(paymentId: string) {
  return useQuery({
    queryKey: ['payment', paymentId],
    queryFn: async () => {
      const { data } = await api.get<Payment>(`/payments/${paymentId}`)
      return data
    },
    enabled: !!paymentId,
  })
}

// Get UPI link and QR for a payment
export function useUPILink(paymentId: string) {
  return useQuery({
    queryKey: ['upi-link', paymentId],
    queryFn: async () => {
      const { data } = await api.get<UPILinkResponse>(`/payments/${paymentId}/upi-link`)
      return data
    },
    enabled: !!paymentId,
  })
}

// Mark payment as paid (member submits UTR)
export function useMutateMarkPaid(paymentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { upi_ref: string }) => {
      const { data } = await api.post<Payment>(`/payments/${paymentId}/mark-paid`, payload)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment', paymentId] })
      void queryClient.invalidateQueries({ queryKey: ['payments'] })
      void queryClient.invalidateQueries({ queryKey: ['cycle-payments'] })
    },
  })
}

// Confirm payment (admin)
export function useMutateConfirmPayment(paymentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Payment>(`/payments/${paymentId}/confirm`)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment', paymentId] })
      void queryClient.invalidateQueries({ queryKey: ['payments'] })
      void queryClient.invalidateQueries({ queryKey: ['cycle-payments'] })
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
  })
}

// Reject payment (admin)
export function useMutateRejectPayment(paymentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { rejection_reason: string }) => {
      const { data } = await api.post<Payment>(`/payments/${paymentId}/reject`, payload)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment', paymentId] })
      void queryClient.invalidateQueries({ queryKey: ['payments'] })
      void queryClient.invalidateQueries({ queryKey: ['cycle-payments'] })
    },
  })
}

// Send payment reminder
export function useMutateRemindPayment(paymentId: string) {
  return useMutation({
    mutationFn: async () => {
      await api.post(`/payments/${paymentId}/remind`)
    },
  })
}
