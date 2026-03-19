import React, { forwardRef } from 'react'
import { cn } from '@/utils/cn'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  disabled?: boolean
  label?: string
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, onBlur, error, disabled, label = 'Phone Number' }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
      onChange(raw)
    }

    const formatted = value
      .replace(/\D/g, '')
      .slice(0, 10)
      .replace(/(\d{5})(\d{0,5})/, '$1 $2')
      .trim()

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-surface-700">
            {label} <span className="text-danger-600">*</span>
          </label>
        )}
        <div className="flex h-12 overflow-hidden rounded-md border border-surface-300 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-600 transition-all">
          <div className="flex items-center bg-surface-50 border-r border-surface-200 px-3 text-sm font-medium text-surface-600 select-none whitespace-nowrap">
            +91
          </div>
          <input
            ref={ref}
            type="tel"
            inputMode="numeric"
            placeholder="98765 43210"
            value={formatted}
            onChange={handleChange}
            onBlur={onBlur}
            disabled={disabled}
            maxLength={11}
            className={cn(
              'flex-1 bg-white px-3 text-sm text-surface-900 placeholder:text-surface-400',
              'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
            )}
            aria-label="Phone number"
          />
        </div>
        {error && (
          <p className="text-xs text-danger-600">{error}</p>
        )}
        <p className="text-xs text-surface-400">Enter 10-digit mobile number</p>
      </div>
    )
  }
)

PhoneInput.displayName = 'PhoneInput'

export { PhoneInput }
