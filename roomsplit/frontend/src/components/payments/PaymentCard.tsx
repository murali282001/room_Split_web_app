import { useState } from 'react'
import { Calendar, User, Hash } from 'lucide-react'
import { Payment } from '@/types/payment'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PaymentStatusBadge } from './PaymentStatusBadge'
import { UpiQrModal } from './UpiQrModal'
import { formatINR } from '@/utils/currency'
import { formatDate, isOverdue } from '@/utils/date'
import { cn } from '@/utils/cn'
import { useMutateConfirmPayment, useMutateRejectPayment } from '@/api/payments'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/store/authStore'

interface PaymentCardProps {
  payment: Payment
  isAdmin?: boolean
  showConfirmActions?: boolean
}

export function PaymentCard({ payment, isAdmin, showConfirmActions }: PaymentCardProps) {
  const [upiModalOpen, setUpiModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const toast = useToast()
  const { user } = useAuthStore()

  const confirm = useMutateConfirmPayment(payment.id)
  const reject = useMutateRejectPayment(payment.id)

  const isMyPayment = user?.id === payment.payer_id
  const overdue = payment.due_date ? isOverdue(payment.due_date) : false

  const rowBg = {
    confirmed: 'border-l-4 border-l-success-500',
    pending: overdue ? 'border-l-4 border-l-danger-500' : 'border-l-4 border-l-warning-400',
    marked_paid: 'border-l-4 border-l-blue-500',
    rejected: 'border-l-4 border-l-danger-400',
    expired: 'border-l-4 border-l-surface-300',
  }[payment.status]

  const handleConfirm = async () => {
    try {
      await confirm.mutateAsync()
      toast.success('Payment confirmed', `${payment.payer_name}'s payment has been confirmed.`)
    } catch {
      toast.error('Failed to confirm payment')
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    try {
      await reject.mutateAsync({ rejection_reason: rejectReason })
      toast.success('Payment rejected')
      setShowRejectForm(false)
      setRejectReason('')
    } catch {
      toast.error('Failed to reject payment')
    }
  }

  return (
    <>
      <Card className={cn('transition-all hover:shadow-md', rowBg)}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: payer info + amount */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold text-sm">
                {payment.payer_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-surface-900">{payment.payer_name}</p>
                  {isMyPayment && (
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-600 font-medium">
                      You
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold text-surface-900 mt-0.5">
                  {formatINR(payment.amount_paise)}
                </p>
              </div>
            </div>

            {/* Right: status + meta */}
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <PaymentStatusBadge status={payment.status} />
              <div className="flex flex-wrap gap-3 text-xs text-surface-500">
                {payment.due_date && (
                  <span className={cn('flex items-center gap-1', overdue && payment.status === 'pending' && 'text-danger-600 font-medium')}>
                    <Calendar className="h-3 w-3" />
                    Due: {formatDate(payment.due_date)}
                    {overdue && payment.status === 'pending' && ' (Overdue)'}
                  </span>
                )}
                {payment.upi_ref && (
                  <span className="flex items-center gap-1 font-mono">
                    <Hash className="h-3 w-3" />
                    {payment.upi_ref}
                  </span>
                )}
              </div>

              {payment.rejection_reason && (
                <p className="text-xs text-danger-600 max-w-xs text-right">
                  Rejected: {payment.rejection_reason}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Member: Pay now if pending */}
            {isMyPayment && payment.status === 'pending' && (
              <Button size="sm" onClick={() => setUpiModalOpen(true)}>
                Pay Now
              </Button>
            )}

            {/* Admin: Confirm / Reject for marked_paid */}
            {isAdmin && showConfirmActions && payment.status === 'marked_paid' && (
              <>
                <Button
                  size="sm"
                  variant="success"
                  loading={confirm.isPending}
                  onClick={handleConfirm}
                >
                  Confirm
                </Button>
                {!showRejectForm ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowRejectForm(true)}
                  >
                    Reject
                  </Button>
                ) : (
                  <div className="flex w-full items-center gap-2 mt-1">
                    <input
                      className="flex-1 h-8 rounded border border-surface-300 px-2 text-sm focus:outline-none focus:border-primary-600"
                      placeholder="Rejection reason..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      loading={reject.isPending}
                      onClick={handleReject}
                    >
                      Confirm Reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowRejectForm(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {upiModalOpen && (
        <UpiQrModal
          paymentId={payment.id}
          isOpen={upiModalOpen}
          onClose={() => setUpiModalOpen(false)}
        />
      )}
    </>
  )
}
