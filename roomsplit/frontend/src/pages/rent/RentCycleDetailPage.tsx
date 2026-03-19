import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Square } from 'lucide-react'
import {
  useCycle,
  useCycleAssignments,
  useCyclePayments,
  useMutateActivateCycle,
  useMutateCloseCycle,
} from '@/api/rent'
import { useMutateConfirmPayment, useMutateRejectPayment } from '@/api/payments'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { PaymentStatusBadge } from '@/components/payments/PaymentStatusBadge'
import { UpiQrModal } from '@/components/payments/UpiQrModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/utils/date'
import { formatINR } from '@/utils/currency'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/utils/cn'
import { Payment } from '@/types/payment'

function PaymentRow({
  payment,
  assignment,
  isAdmin,
  isMyPayment,
  canConfirm,
}: {
  payment: Payment
  assignment?: { assigned_amount_paise: number }
  isAdmin: boolean
  isMyPayment: boolean
  canConfirm: boolean
}) {
  const [qrOpen, setQrOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const toast = useToast()

  const confirm = useMutateConfirmPayment(payment.id)
  const reject = useMutateRejectPayment(payment.id)

  const rowColor = {
    confirmed: 'bg-success-50',
    pending: 'bg-white',
    marked_paid: 'bg-blue-50',
    rejected: 'bg-danger-50',
    expired: 'bg-surface-50',
  }[payment.status]

  const handleConfirm = async () => {
    try {
      await confirm.mutateAsync()
      toast.success(`${payment.payer_name}'s payment confirmed`)
    } catch {
      toast.error('Failed to confirm payment')
    }
  }

  const handleReject = async () => {
    try {
      await reject.mutateAsync({ rejection_reason: rejectReason })
      toast.success('Payment rejected')
      setShowRejectInput(false)
    } catch {
      toast.error('Failed to reject payment')
    }
  }

  return (
    <>
      <tr className={cn('border-b border-surface-100', rowColor)}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-semibold shrink-0">
              {payment.payer_name.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium text-surface-900 text-sm">{payment.payer_name}</span>
            {isMyPayment && <span className="text-xs bg-primary-100 text-primary-600 rounded-full px-1.5 py-0.5">You</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-surface-900">
          {formatINR(assignment?.assigned_amount_paise ?? payment.amount_paise)}
        </td>
        <td className="px-4 py-3">
          <PaymentStatusBadge status={payment.status} />
        </td>
        <td className="px-4 py-3 text-xs font-mono text-surface-500">
          {payment.upi_ref ?? '—'}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {isMyPayment && payment.status === 'pending' && (
              <Button size="sm" onClick={() => setQrOpen(true)}>Pay Now</Button>
            )}
            {isAdmin && canConfirm && payment.status === 'marked_paid' && (
              <>
                <Button size="sm" variant="success" loading={confirm.isPending} onClick={handleConfirm}>
                  Confirm
                </Button>
                {!showRejectInput ? (
                  <Button size="sm" variant="destructive" onClick={() => setShowRejectInput(true)}>
                    Reject
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <input
                      className="h-7 w-28 rounded border border-surface-300 px-2 text-xs"
                      placeholder="Reason..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <Button size="sm" variant="destructive" loading={reject.isPending} onClick={handleReject}>OK</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowRejectInput(false)}>✕</Button>
                  </div>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
      {qrOpen && (
        <UpiQrModal paymentId={payment.id} isOpen={qrOpen} onClose={() => setQrOpen(false)} />
      )}
    </>
  )
}

export default function RentCycleDetailPage() {
  const { groupId, cycleId } = useParams<{ groupId: string; cycleId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuthStore()

  const canActivate = usePermission(groupId ?? '', 'cycle.activate')
  const canConfirm = usePermission(groupId ?? '', 'payment.confirm')

  const { data: cycle, isLoading: cycleLoading } = useCycle(groupId ?? '', cycleId ?? '')
  const { data: assignments } = useCycleAssignments(groupId ?? '', cycleId ?? '')
  const { data: payments, isLoading: paymentsLoading } = useCyclePayments(groupId ?? '', cycleId ?? '')

  const activateCycle = useMutateActivateCycle(groupId ?? '', cycleId ?? '')
  const closeCycle = useMutateCloseCycle(groupId ?? '', cycleId ?? '')

  const confirmedPaise = (payments ?? [])
    .filter((p) => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amount_paise, 0)

  if (cycleLoading) return <FullPageSpinner />
  if (!cycle) return null

  const statusVariant = {
    draft: 'draft' as const,
    active: 'active' as const,
    closed: 'closed' as const,
    cancelled: 'cancelled' as const,
  }[cycle.status]

  const handleActivate = async () => {
    try {
      await activateCycle.mutateAsync()
      toast.success('Cycle activated!')
    } catch {
      toast.error('Failed to activate cycle')
    }
  }

  const handleClose = async () => {
    if (!confirm('Close this cycle? All pending payments will expire.')) return
    try {
      await closeCycle.mutateAsync()
      toast.success('Cycle closed')
    } catch {
      toast.error('Failed to close cycle')
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Back button */}
      <button
        className="flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700"
        onClick={() => navigate(`/groups/${groupId}/rent`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Cycles
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-900">{cycle.label}</h1>
            <Badge variant={statusVariant} className="capitalize">{cycle.status}</Badge>
          </div>
          <p className="text-sm text-surface-500 mt-1">
            {formatDate(cycle.period_start)} – {formatDate(cycle.period_end)} · Due {formatDate(cycle.due_date)}
          </p>
        </div>
        <div className="flex gap-2">
          {canActivate && cycle.status === 'draft' && (
            <Button
              leftIcon={<Play className="h-4 w-4" />}
              loading={activateCycle.isPending}
              onClick={handleActivate}
            >
              Activate Cycle
            </Button>
          )}
          {canActivate && cycle.status === 'active' && (
            <Button
              variant="outline"
              leftIcon={<Square className="h-4 w-4" />}
              loading={closeCycle.isPending}
              onClick={handleClose}
            >
              Close Cycle
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-surface-500 uppercase tracking-wide">Total Rent</p>
            <p className="text-2xl font-bold text-surface-900 mt-1">{formatINR(cycle.total_amount_paise)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-surface-500 uppercase tracking-wide">Collected</p>
            <p className="text-2xl font-bold text-success-700 mt-1">{formatINR(confirmedPaise)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-surface-500 uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold text-warning-700 mt-1">
              {formatINR(Math.max(0, cycle.total_amount_paise - confirmedPaise))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Collection Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressBar collected={confirmedPaise} target={cycle.total_amount_paise} />
        </CardContent>
      </Card>

      {/* Payment table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Member Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {paymentsLoading ? (
            <div className="p-6">Loading...</div>
          ) : !payments || payments.length === 0 ? (
            <EmptyState
              title="No payments yet"
              description="Payments will appear once the cycle is activated."
              className="py-12"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 border-b border-surface-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600">Member</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600">Amount</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600 hidden md:table-cell">UPI Ref</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const assignment = assignments?.find((a) => a.member_id === p.payer_id)
                    return (
                      <PaymentRow
                        key={p.id}
                        payment={p}
                        assignment={assignment}
                        isAdmin={canConfirm}
                        isMyPayment={p.payer_id === user?.id}
                        canConfirm={canConfirm}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
