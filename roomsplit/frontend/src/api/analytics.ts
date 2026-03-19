import { useQuery } from '@tanstack/react-query'
import { api } from './client'

interface AnalyticsSummary {
  has_active_cycle: boolean
  total_collected_paise: number
  total_collected_rupees: number
  outstanding_paise: number
  outstanding_rupees: number
  overdue_count: number
  collection_rate_percent: number
}

interface PaymentTrendPoint {
  month: string
  collected_rupees: number
  outstanding_rupees: number
}

interface MemberStanding {
  member_id: string
  member_name: string
  total_paid_rupees: number
  total_owed_rupees: number
  on_time_rate: number
  status: 'good' | 'overdue' | 'behind'
}

interface ExpenseBreakdown {
  category: string
  total_rupees: number
  percentage: number
}

export function useAnalyticsSummary(groupId: string) {
  return useQuery({
    queryKey: ['analytics-summary', groupId],
    queryFn: async () => {
      const { data } = await api.get<AnalyticsSummary>(`/groups/${groupId}/analytics/summary`)
      return data
    },
    enabled: !!groupId,
  })
}

export function usePaymentTrend(groupId: string) {
  return useQuery({
    queryKey: ['payment-trend', groupId],
    queryFn: async () => {
      const { data } = await api.get<PaymentTrendPoint[]>(`/groups/${groupId}/analytics/trend`)
      return data
    },
    enabled: !!groupId,
  })
}

export function useMemberStandings(groupId: string) {
  return useQuery({
    queryKey: ['member-standings', groupId],
    queryFn: async () => {
      const { data } = await api.get<MemberStanding[]>(`/groups/${groupId}/analytics/standings`)
      return data
    },
    enabled: !!groupId,
  })
}

export function useExpenseBreakdown(groupId: string) {
  return useQuery({
    queryKey: ['expense-breakdown', groupId],
    queryFn: async () => {
      const { data } = await api.get<ExpenseBreakdown[]>(
        `/groups/${groupId}/analytics/expense-breakdown`
      )
      return data
    },
    enabled: !!groupId,
  })
}
