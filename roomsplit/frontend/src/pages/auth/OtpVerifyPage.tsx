import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { OtpInput } from '@/components/auth/OtpInput'
import { Button } from '@/components/ui/Button'
import { useMutateVerifyOtp, useMutateRequestOtp } from '@/api/auth'
import { useToast } from '@/hooks/useToast'

export default function OtpVerifyPage() {
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [countdown, setCountdown] = useState(30)
  const [canResend, setCanResend] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  const phone = (location.state as { phone?: string } | null)?.phone ?? ''
  const verifyOtp = useMutateVerifyOtp()
  const requestOtp = useMutateRequestOtp()

  // Redirect if no phone
  useEffect(() => {
    if (!phone) {
      navigate('/login', { replace: true })
    }
  }, [phone, navigate])

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true)
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleComplete = async (value: string) => {
    if (value.length !== 6) return
    setOtpError('')
    try {
      const result = await verifyOtp.mutateAsync({ phone, otp: value })
      toast.success('Logged in successfully!')
      if (result.is_new_user) {
        navigate('/profile-setup', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch {
      setOtpError('Invalid OTP. Please try again.')
      setOtp('')
    }
  }

  const handleResend = async () => {
    if (!canResend) return
    try {
      await requestOtp.mutateAsync(phone)
      setCountdown(30)
      setCanResend(false)
      setOtp('')
      setOtpError('')
      toast.success('OTP resent!', `We sent a new code to +91${phone}`)
    } catch {
      toast.error('Failed to resend OTP')
    }
  }

  // phone is +91XXXXXXXXXX — mask the middle 4 digits of the 10-digit part
  const digits = phone.replace('+91', '')
  const maskedPhone = digits.replace(/(\d{2})(\d{4})(\d{4})/, '$1XXXX$3')

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-surface-100 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg mb-4">
            <span className="text-2xl font-bold text-white">RS</span>
          </div>
          <h1 className="text-2xl font-bold text-surface-900">RoomSplit</h1>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-lg border border-surface-100">
          <button
            className="flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 mb-6"
            onClick={() => navigate('/login')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <h2 className="text-xl font-semibold text-surface-900 mb-1">Enter OTP</h2>
          <p className="text-sm text-surface-500 mb-6">
            We sent a 6-digit code to{' '}
            <span className="font-semibold text-surface-700">+91 {maskedPhone}</span>
            <br />
            <span className="text-xs text-surface-400">Check the backend logs for the OTP (console mode)</span>
          </p>

          <OtpInput
            value={otp}
            onChange={setOtp}
            onComplete={handleComplete}
            disabled={verifyOtp.isPending}
            error={otpError}
          />

          {verifyOtp.isPending && (
            <p className="text-center text-sm text-primary-600 mt-4 animate-pulse">
              Verifying...
            </p>
          )}

          <div className="mt-8 text-center">
            {canResend ? (
              <Button
                variant="ghost"
                onClick={handleResend}
                loading={requestOtp.isPending}
                leftIcon={<RefreshCw className="h-4 w-4" />}
                className="text-sm"
              >
                Resend OTP
              </Button>
            ) : (
              <p className="text-sm text-surface-500">
                Resend OTP in{' '}
                <span className="font-semibold text-surface-700">{countdown}s</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
