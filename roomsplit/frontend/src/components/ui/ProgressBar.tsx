import { cn } from '@/utils/cn'
import { formatINR } from '@/utils/currency'

interface ProgressBarProps {
  collected: number   // in paise
  target: number      // in paise
  showLabels?: boolean
  showPercentage?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function ProgressBar({
  collected,
  target,
  showLabels = true,
  showPercentage = true,
  className,
  size = 'md',
}: ProgressBarProps) {
  const percentage = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0

  const barColor =
    percentage >= 100
      ? 'bg-success-600'
      : percentage >= 50
      ? 'bg-warning-500'
      : 'bg-danger-500'

  const heightClass = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }[size]

  return (
    <div className={cn('w-full', className)}>
      {showLabels && (
        <div className="flex items-center justify-between mb-1.5 text-xs text-surface-600">
          <span>Collected: <span className="font-semibold text-surface-900">{formatINR(collected)}</span></span>
          <span>Target: <span className="font-semibold text-surface-900">{formatINR(target)}</span></span>
        </div>
      )}
      <div className={cn('w-full rounded-full bg-surface-200 overflow-hidden', heightClass)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showPercentage && (
        <div className="flex justify-end mt-1">
          <span
            className={cn(
              'text-xs font-semibold',
              percentage >= 100
                ? 'text-success-600'
                : percentage >= 50
                ? 'text-warning-600'
                : 'text-danger-600'
            )}
          >
            {percentage}%
          </span>
        </div>
      )}
    </div>
  )
}
