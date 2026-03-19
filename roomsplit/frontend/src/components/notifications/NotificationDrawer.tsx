import { useNavigate } from 'react-router-dom'
import { Bell, X, CheckCheck, Info, CreditCard, AlertTriangle, Users } from 'lucide-react'
import { useNotifications, useMutateMarkRead, useMutateMarkAllRead } from '@/api/notifications'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { timeAgo } from '@/utils/date'
import { cn } from '@/utils/cn'
import { Notification } from '@/types/notification'

interface NotificationDrawerProps {
  open: boolean
  onClose: () => void
}

function NotificationIcon({ type }: { type: string }) {
  const lower = type.toLowerCase()
  if (lower.includes('payment')) return <CreditCard className="h-4 w-4 text-primary-600" />
  if (lower.includes('warning') || lower.includes('overdue')) return <AlertTriangle className="h-4 w-4 text-warning-600" />
  if (lower.includes('member') || lower.includes('group')) return <Users className="h-4 w-4 text-success-600" />
  return <Info className="h-4 w-4 text-surface-500" />
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification
  onRead: (id: string, link?: string) => void
}) {
  const link = notification.data?.link as string | undefined

  return (
    <button
      className={cn(
        'w-full text-left px-4 py-3 hover:bg-surface-50 transition-colors border-b border-surface-100',
        !notification.is_read && 'bg-primary-50'
      )}
      onClick={() => onRead(notification.id, link)}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          notification.is_read ? 'bg-surface-100' : 'bg-primary-100'
        )}>
          <NotificationIcon type={notification.type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn(
              'text-sm truncate',
              notification.is_read ? 'text-surface-700' : 'font-semibold text-surface-900'
            )}>
              {notification.title}
            </p>
            {!notification.is_read && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600" />
            )}
          </div>
          <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{notification.body}</p>
          <p className="text-xs text-surface-400 mt-1">{timeAgo(notification.created_at)}</p>
        </div>
      </div>
    </button>
  )
}

export default function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  const navigate = useNavigate()
  const { data, isLoading } = useNotifications({ page_size: 30 })
  const markRead = useMutateMarkRead()
  const markAllRead = useMutateMarkAllRead()

  const notifications = data?.items ?? []
  const hasUnread = notifications.some((n) => !n.is_read)

  const handleRead = async (id: string, link?: string) => {
    await markRead.mutateAsync([id])
    if (link) {
      navigate(link)
      onClose()
    }
  }

  const handleMarkAllRead = async () => {
    await markAllRead.mutateAsync()
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-200 px-4 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-surface-700" />
            <h2 className="text-base font-semibold text-surface-900">Notifications</h2>
          </div>
          <div className="flex items-center gap-2">
            {hasUnread && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleMarkAllRead}
                loading={markAllRead.isPending}
                leftIcon={<CheckCheck className="h-4 w-4" />}
                className="text-xs"
              >
                Mark all read
              </Button>
            )}
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-surface-500 hover:bg-surface-100"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner label="Loading notifications..." />
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-6 w-6" />}
              title="No notifications"
              description="You're all caught up! Notifications will appear here."
            />
          ) : (
            <div>
              {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onRead={handleRead} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
