import React, { useRef, useState, useEffect } from 'react'
import { cn } from '@/utils/cn'

interface OtpInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  error?: string
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
  error,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [localValues, setLocalValues] = useState<string[]>(
    value.split('').concat(Array(length).fill('')).slice(0, length)
  )

  useEffect(() => {
    const newValues = value.split('').concat(Array(length).fill('')).slice(0, length)
    setLocalValues(newValues)
  }, [value, length])

  const focusInput = (index: number) => {
    if (index >= 0 && index < length) {
      inputRefs.current[index]?.focus()
      inputRefs.current[index]?.select()
    }
  }

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1)
    const newValues = [...localValues]
    newValues[index] = digit
    setLocalValues(newValues)
    const combined = newValues.join('')
    onChange(combined)

    if (digit && index < length - 1) {
      focusInput(index + 1)
    }

    if (combined.replace(/\s/g, '').length === length) {
      onComplete?.(combined)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (localValues[index]) {
        const newValues = [...localValues]
        newValues[index] = ''
        setLocalValues(newValues)
        onChange(newValues.join(''))
      } else if (index > 0) {
        focusInput(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      focusInput(index + 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const newValues = pasted.split('').concat(Array(length).fill('')).slice(0, length)
    setLocalValues(newValues)
    onChange(newValues.join(''))
    const lastFilled = Math.min(pasted.length, length - 1)
    focusInput(lastFilled)
    if (pasted.length >= length) {
      onComplete?.(pasted.slice(0, length))
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2 sm:gap-3" onPaste={handlePaste}>
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={localValues[i] ?? ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={disabled}
            className={cn(
              'flex h-12 w-10 sm:w-12 items-center justify-center rounded-lg border-2 text-center text-lg font-semibold',
              'text-surface-900 transition-all',
              'focus:outline-none focus:border-primary-600 focus:ring-0',
              'disabled:cursor-not-allowed disabled:opacity-50',
              localValues[i]
                ? 'border-primary-600 bg-primary-50'
                : 'border-surface-300 bg-white',
              error && 'border-danger-400'
            )}
            aria-label={`OTP digit ${i + 1}`}
          />
        ))}
      </div>
      {error && (
        <p className="text-sm text-danger-600">{error}</p>
      )}
    </div>
  )
}
