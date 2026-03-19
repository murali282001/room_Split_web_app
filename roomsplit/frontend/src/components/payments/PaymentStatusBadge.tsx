import { Badge, paymentStatusLabels } from '@/components/ui/Badge'
import { PaymentStatus } from '@/types/payment'

interface PaymentStatusBadgeProps {
  status: PaymentStatus
}

const statusVariantMap: Record<PaymentStatus, 'pending' | 'marked_paid' | 'confirmed' | 'rejected' | 'expired'> = {
  pending: 'pending',
  marked_paid: 'marked_paid',
  confirmed: 'confirmed',
  rejected: 'rejected',
  expired: 'expired',
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  return (
    <Badge variant={statusVariantMap[status]}>
      {paymentStatusLabels[status]}
    </Badge>
  )
}
