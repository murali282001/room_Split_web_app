import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatRupees } from '@/utils/currency'

interface MemberSummaryCardProps {
  memberName: string
  totalPaidRupees: number
  totalOwedRupees: number
  status: 'good' | 'overdue' | 'behind'
}

const statusLabels: Record<string, string> = {
  good: 'Up to date',
  overdue: 'Overdue',
  behind: 'Behind',
}

export function MemberSummaryCard({
  memberName,
  totalPaidRupees,
  totalOwedRupees,
  status,
}: MemberSummaryCardProps) {
  const balance = totalPaidRupees - totalOwedRupees
  const isPositive = balance >= 0

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold text-sm">
              {memberName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-surface-900 text-sm">{memberName}</p>
              <Badge variant={status} className="mt-1">
                {statusLabels[status]}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-1 text-sm">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-success-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-danger-600" />
            )}
            <span className={isPositive ? 'text-success-700 font-semibold' : 'text-danger-700 font-semibold'}>
              {isPositive ? '+' : ''}{formatRupees(balance)}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-success-50 px-2 py-1.5">
            <p className="text-success-600 font-medium">Paid</p>
            <p className="text-success-700 font-bold text-sm">{formatRupees(totalPaidRupees)}</p>
          </div>
          <div className="rounded-md bg-danger-50 px-2 py-1.5">
            <p className="text-danger-600 font-medium">Owed</p>
            <p className="text-danger-700 font-bold text-sm">{formatRupees(totalOwedRupees)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
