import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { AuditLog } from '@/types/audit'
import { PaginatedResponse } from '@/types/common'

interface AuditParams {
  page?: number
  page_size?: number
  action?: string
  entity_type?: string
  actor_name?: string
  date_from?: string
  date_to?: string
}

// Get audit logs for a group
export function useAuditLogs(groupId: string, params?: AuditParams) {
  return useQuery({
    queryKey: ['audit-logs', groupId, params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<AuditLog>>(
        `/groups/${groupId}/audit`,
        { params }
      )
      return data
    },
    enabled: !!groupId,
  })
}
