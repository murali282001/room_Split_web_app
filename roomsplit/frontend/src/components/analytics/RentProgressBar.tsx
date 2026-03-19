import { ProgressBar } from '@/components/ui/ProgressBar'
import { RentCycle } from '@/types/payment'
import { formatDate } from '@/utils/date'

interface RentProgressBarProps {
  cycle: RentCycle
  collectedPaise: number
}

export function RentProgressBar({ cycle, collectedPaise }: RentProgressBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-surface-700">{cycle.label}</span>
        <span className="text-xs text-surface-500">Due {formatDate(cycle.due_date)}</span>
      </div>
      <ProgressBar
        collected={collectedPaise}
        target={cycle.total_amount_paise}
        showLabels
        showPercentage
      />
    </div>
  )
}
