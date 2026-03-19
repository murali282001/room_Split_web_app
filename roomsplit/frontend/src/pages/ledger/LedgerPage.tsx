import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { BookOpen, Filter } from 'lucide-react'
import { usePayments } from '@/api/payments'
import { useMembers } from '@/api/groups'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { SkeletonTable } from '@/components/ui/SkeletonCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { PaymentStatusBadge } from '@/components/payments/PaymentStatusBadge'
import { formatINR } from '@/utils/currency'
import { formatDate, formatDateTime } from '@/utils/date'
import { cn } from '@/utils/cn'
import { PaymentStatus, PaymentType } from '@/types/payment'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'marked_paid', label: 'Marked Paid' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'rent', label: 'Rent' },
  { value: 'expense', label: 'Expense' },
  { value: 'withdrawal', label: 'Withdrawal' },
]

const rowBgByStatus: Record<PaymentStatus, string> = {
  confirmed: 'bg-success-50',
  pending: 'bg-white',
  marked_paid: 'bg-blue-50',
  rejected: 'bg-danger-50',
  expired: 'bg-surface-50',
}

export default function LedgerPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: members } = useMembers(groupId ?? '')
  const { data, isLoading } = usePayments(groupId ?? '', {
    status: status === 'all' ? undefined : status,
    payment_type: type === 'all' ? undefined : type,
    page,
    page_size: 25,
  })

  const payments = (data?.items ?? []).filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.payer_name.toLowerCase().includes(q) ||
      (p.upi_ref?.toLowerCase().includes(q) ?? false)
    )
  })

  const totalCredits = payments
    .filter((p) => p.status === 'confirmed')
    .reduce((s, p) => s + p.amount_paise, 0)

  const totalDebits = payments
    .filter((p) => p.status === 'rejected' || p.status === 'expired')
    .reduce((s, p) => s + p.amount_paise, 0)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Ledger</h1>
        <p className="text-sm text-surface-500 mt-0.5">Complete payment history</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-surface-500 uppercase tracking-wide">Total Credits (Confirmed)</p>
            <p className="text-2xl font-bold text-success-700 mt-1">{formatINR(totalCredits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-surface-500 uppercase tracking-wide">Total Debits (Rejected/Expired)</p>
            <p className="text-2xl font-bold text-danger-700 mt-1">{formatINR(totalDebits)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white rounded-lg border border-surface-200 p-4">
        <Filter className="h-4 w-4 text-surface-400 mt-2.5 shrink-0" />
        <Input
          placeholder="Search by name or UPI ref..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48"
        />
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-surface-200 overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={8} />
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="No entries found"
            description="Try adjusting your filters."
            className="py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600">Member</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 hidden sm:table-cell">Type</th>
                  <th className="text-right px-4 py-3 font-semibold text-surface-600">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 hidden md:table-cell">UPI Ref</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className={cn('border-b border-surface-100', rowBgByStatus[p.status])}
                  >
                    <td className="px-4 py-3 text-xs text-surface-500 whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-surface-900">{p.payer_name}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="capitalize text-surface-600 text-xs">{p.payment_type}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'font-bold',
                        p.status === 'confirmed' ? 'text-success-700' : 'text-surface-900'
                      )}>
                        {formatINR(p.amount_paise)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-surface-500 hidden md:table-cell">
                      {p.upi_ref ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-surface-600">Page {data.page} of {data.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
