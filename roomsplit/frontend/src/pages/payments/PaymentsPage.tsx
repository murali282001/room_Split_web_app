import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CreditCard, Filter } from 'lucide-react'
import { usePayments } from '@/api/payments'
import { useMembers } from '@/api/groups'
import { usePermission } from '@/hooks/usePermission'
import { Card, CardContent } from '@/components/ui/Card'
import { PaymentCard } from '@/components/payments/PaymentCard'
import { SkeletonCard } from '@/components/ui/SkeletonCard'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { formatINR } from '@/utils/currency'
import { PaymentStatus } from '@/types/payment'

const STATUSES: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'marked_paid', label: 'Awaiting Confirmation' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
]

function SummaryCard({
  label,
  count,
  amount,
  color,
}: {
  label: string
  count: number
  amount: number
  color: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-surface-500 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{count}</p>
        <p className="text-sm text-surface-500 mt-0.5">{formatINR(amount)}</p>
      </CardContent>
    </Card>
  )
}

export default function PaymentsPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [status, setStatus] = useState('all')
  const [memberId, setMemberId] = useState('all')
  const [page, setPage] = useState(1)

  const canConfirm = usePermission(groupId ?? '', 'payment.confirm')
  const { data: members } = useMembers(groupId ?? '')
  const { data, isLoading } = usePayments(groupId ?? '', {
    status: status === 'all' ? undefined : status,
    member_id: memberId === 'all' ? undefined : memberId,
    page,
    page_size: 20,
  })

  const payments = data?.items ?? []
  const allPayments = payments

  const countByStatus = (s: PaymentStatus) =>
    allPayments.filter((p) => p.status === s).length

  const amountByStatus = (s: PaymentStatus) =>
    allPayments.filter((p) => p.status === s).reduce((sum, p) => sum + p.amount_paise, 0)

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Payments</h1>
        <p className="text-sm text-surface-500 mt-0.5">{data?.total ?? 0} total payments</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Total"
          count={payments.length}
          amount={payments.reduce((s, p) => s + p.amount_paise, 0)}
          color="text-surface-900"
        />
        <SummaryCard
          label="Confirmed"
          count={countByStatus('confirmed')}
          amount={amountByStatus('confirmed')}
          color="text-success-700"
        />
        <SummaryCard
          label="Pending"
          count={countByStatus('pending') + countByStatus('marked_paid')}
          amount={amountByStatus('pending') + amountByStatus('marked_paid')}
          color="text-warning-700"
        />
        <SummaryCard
          label="Rejected"
          count={countByStatus('rejected')}
          amount={amountByStatus('rejected')}
          color="text-danger-700"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white rounded-lg border border-surface-200 p-4">
        <Filter className="h-4 w-4 text-surface-400 shrink-0" />
        <div className="flex flex-wrap gap-3 flex-1">
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={memberId} onValueChange={(v) => { setMemberId(v); setPage(1) }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {members?.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.user_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Payments list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
          title="No payments found"
          description="Try adjusting your filters."
        />
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <PaymentCard
              key={p.id}
              payment={p}
              isAdmin={canConfirm}
              showConfirmActions={canConfirm}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-surface-600">
            Page {data.page} of {data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
