import React from 'react'
import { cn } from '@/utils/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftAddon?: React.ReactNode
  rightAddon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftAddon, rightAddon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-surface-700"
          >
            {label}
            {props.required && <span className="ml-1 text-danger-600">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3 flex items-center text-surface-500">
              {leftAddon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm',
              'text-surface-900 placeholder:text-surface-400',
              'focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors',
              error
                ? 'border-danger-500 focus:ring-danger-500'
                : 'border-surface-300',
              leftAddon && 'pl-10',
              rightAddon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 flex items-center text-surface-500">
              {rightAddon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-danger-600">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-surface-500">{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
