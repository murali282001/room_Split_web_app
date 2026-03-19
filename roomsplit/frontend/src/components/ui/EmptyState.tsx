import React from 'react'
import { cn } from '@/utils/cn'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline'
  }
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-100 text-surface-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-surface-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-surface-500 max-w-sm">{description}</p>
      )}
      {action && (
        <Button
          className="mt-6"
          variant={action.variant || 'default'}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
