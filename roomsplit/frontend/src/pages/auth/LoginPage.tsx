import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneInput } from '@/components/auth/PhoneInput'
import { Button } from '@/components/ui/Button'
import { useMutateRequestOtp } from '@/api/auth'
import { useToast } from '@/hooks/useToast'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const navigate = useNavigate()
  const toast = useToast()
  const requestOtp = useMutateRequestOtp()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')

    if (digits.length !== 10) {
      setPhoneError('Please enter a valid 10-digit mobile number')
      return
    }
    setPhoneError('')

    const formattedPhone = `+91${digits}`

    try {
      await requestOtp.mutateAsync(formattedPhone)
      toast.success('OTP sent!', `We sent a code to +91${digits}`)
      navigate('/otp', { state: { phone: formattedPhone } })
    } catch {
      toast.error('Failed to send OTP', 'Please check your number and try again.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-surface-100 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg mb-4">
            <span className="text-2xl font-bold text-white">RS</span>
          </div>
          <h1 className="text-2xl font-bold text-surface-900">RoomSplit</h1>
          <p className="text-sm text-surface-500 mt-1">Smart rent splitting for roommates</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-lg border border-surface-100">
          <h2 className="text-xl font-semibold text-surface-900 mb-1">Welcome back</h2>
          <p className="text-sm text-surface-500 mb-6">Enter your phone number to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <PhoneInput
              value={phone}
              onChange={setPhone}
              error={phoneError}
              onBlur={() => {
                const digits = phone.replace(/\D/g, '')
                if (digits.length > 0 && digits.length !== 10) {
                  setPhoneError('Please enter a valid 10-digit number')
                } else {
                  setPhoneError('')
                }
              }}
            />
            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={requestOtp.isPending}
            >
              Send OTP
            </Button>
          </form>

        </div>

        <p className="mt-6 text-center text-xs text-surface-400">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
