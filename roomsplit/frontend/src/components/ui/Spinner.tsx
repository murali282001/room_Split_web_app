import { cn } from '@/utils/cn'
import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

export function Spinner({ className, size = 'md', label }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center gap-2" role="status" aria-label={label || 'Loading'}>
      <Loader2 className={cn('animate-spin text-primary-600', sizeMap[size], className)} />
      {label && <span className="text-sm text-surface-500">{label}</span>}
    </div>
  )
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Spinner size="lg" label={label || 'Loading...'} />
    </div>
  )
}
