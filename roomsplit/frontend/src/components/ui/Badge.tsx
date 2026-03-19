import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'
import { PaymentStatus } from '@/types/payment'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-surface-100 text-surface-700',
        confirmed: 'bg-success-100 text-success-700',
        paid: 'bg-success-100 text-success-700',
        pending: 'bg-warning-100 text-warning-700',
        marked_paid: 'bg-blue-100 text-blue-700',
        rejected: 'bg-danger-100 text-danger-700',
        expired: 'bg-surface-100 text-surface-500',
        overdue: 'bg-orange-100 text-orange-700',
        active: 'bg-primary-100 text-primary-700',
        draft: 'bg-surface-100 text-surface-600',
        closed: 'bg-surface-200 text-surface-600',
        cancelled: 'bg-danger-100 text-danger-600',
        settled: 'bg-success-100 text-success-700',
        suspended: 'bg-warning-100 text-warning-700',
        left: 'bg-surface-100 text-surface-500',
        good: 'bg-success-100 text-success-700',
        behind: 'bg-danger-100 text-danger-700',
        approved: 'bg-success-100 text-success-700',
        completed: 'bg-success-100 text-success-700',
        credit: 'bg-success-100 text-success-700',
        debit: 'bg-danger-100 text-danger-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

// Convenience: payment status badge labels
export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: 'Pending',
  marked_paid: 'Awaiting Confirmation',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  expired: 'Expired',
}

export { Badge, badgeVariants }
