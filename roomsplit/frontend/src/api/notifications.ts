import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { Notification } from '@/types/notification'
import { PaginatedResponse } from '@/types/common'
import { useNotificationStore } from '@/store/notificationStore'

interface NotificationParams {
  page?: number
  page_size?: number
  is_read?: boolean
}

// List notifications
export function useNotifications(params?: NotificationParams) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Notification>>('/notifications', { params })
      return data
    },
  })
}

// Get unread count — refetches every 30 seconds
export function useUnreadCount() {
  const { setUnreadCount } = useNotificationStore()
  return useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>('/notifications/unread-count')
      setUnreadCount(data.count)
      return data.count
    },
    refetchInterval: 30_000,
  })
}

// Mark notification(s) as read
export function useMutateMarkRead() {
  const queryClient = useQueryClient()
  const { decrement } = useNotificationStore()
  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      await api.post('/notifications/mark-read', { ids: notificationIds })
    },
    onSuccess: (_, ids) => {
      decrement()
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
      return ids
    },
  })
}

// Mark all as read
export function useMutateMarkAllRead() {
  const queryClient = useQueryClient()
  const { setUnreadCount } = useNotificationStore()
  return useMutation({
    mutationFn: async () => {
      await api.post('/notifications/mark-all-read')
    },
    onSuccess: () => {
      setUnreadCount(0)
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })
}
