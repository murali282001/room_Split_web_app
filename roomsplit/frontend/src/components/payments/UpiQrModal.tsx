import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ExternalLink, QrCode, CheckCircle, Loader2, Smartphone } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useUPILink, useMutateMarkPaid } from '@/api/payments'
import { formatRupees } from '@/utils/currency'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/hooks/useToast'

const markPaidSchema = z.object({
  upi_ref: z.string().min(8, 'Transaction ID must be at least 8 characters').max(50, 'Too long'),
})

type MarkPaidFormData = z.infer<typeof markPaidSchema>

interface UpiQrModalProps {
  paymentId: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function UpiQrModal({ paymentId, isOpen, onClose, onSuccess }: UpiQrModalProps) {
  const [showUtrForm, setShowUtrForm] = useState(false)
  const [paymentDone, setPaymentDone] = useState(false)
  const toast = useToast()

  const { data: upiData, isLoading, error } = useUPILink(paymentId)
  const markPaid = useMutateMarkPaid(paymentId)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MarkPaidFormData>({
    resolver: zodResolver(markPaidSchema),
  })

  const handleOpenUpiApp = () => {
    if (upiData?.upi_link) {
      window.open(upiData.upi_link, '_blank')
    }
  }

  const handleMarkPaid = async (data: MarkPaidFormData) => {
    try {
      await markPaid.mutateAsync({ upi_ref: data.upi_ref })
      setPaymentDone(true)
      toast.success('Payment submitted!', 'Your payment is pending confirmation.')
      reset()
      onSuccess?.()
    } catch {
      toast.error('Failed to submit payment', 'Please try again.')
    }
  }

  const handleClose = () => {
    setShowUtrForm(false)
    setPaymentDone(false)
    reset()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary-600" />
            Pay Rent
          </DialogTitle>
          <DialogDescription>
            Scan QR or tap the UPI button to pay
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" label="Loading payment details..." />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-danger-50 border border-danger-200 p-4 text-sm text-danger-700">
              Failed to load payment details. Please try again.
            </div>
          )}

          {paymentDone && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
                <CheckCircle className="h-8 w-8 text-success-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-surface-900">Payment Submitted!</p>
                <p className="text-sm text-surface-500 mt-1">
                  Your payment is awaiting confirmation from the admin.
                </p>
              </div>
            </div>
          )}

          {!isLoading && !error && !paymentDone && upiData && (
            <div className="space-y-6">
              {/* Amount display */}
              <div className="rounded-xl bg-primary-50 border border-primary-100 p-4 text-center">
                <p className="text-xs font-medium text-primary-600 uppercase tracking-wide">Amount Due</p>
                <p className="text-3xl font-bold text-primary-700 mt-1">
                  {formatRupees(upiData.amount_rupees)}
                </p>
              </div>

              {/* Payee info */}
              <div className="rounded-lg bg-surface-50 p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-surface-500">Pay to</span>
                  <span className="font-medium text-surface-900">{upiData.payee_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-surface-500">UPI ID</span>
                  <span className="font-mono text-surface-700 text-xs">{upiData.payee_upi}</span>
                </div>
              </div>

              {/* QR Code */}
              {upiData.qr_code_base64 && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-surface-500 font-medium">Scan with any UPI app</p>
                  <div className="rounded-xl border-2 border-surface-200 p-3 bg-white inline-block">
                    <img
                      src={`data:image/png;base64,${upiData.qr_code_base64}`}
                      alt="UPI QR Code"
                      className="h-48 w-48 object-contain"
                    />
                  </div>
                </div>
              )}

              {/* UPI deep link button */}
              <Button
                className="w-full h-12 text-base"
                onClick={handleOpenUpiApp}
                leftIcon={<Smartphone className="h-5 w-5" />}
                rightIcon={<ExternalLink className="h-4 w-4" />}
              >
                Open UPI App to Pay
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-surface-200" />
                <span className="text-xs text-surface-400">After payment</span>
                <div className="flex-1 h-px bg-surface-200" />
              </div>

              {/* UTR Form */}
              {!showUtrForm ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowUtrForm(true)}
                >
                  I have paid — Enter Transaction ID
                </Button>
              ) : (
                <form onSubmit={handleSubmit(handleMarkPaid)} className="space-y-4">
                  <Input
                    {...register('upi_ref')}
                    label="UPI Transaction / UTR Reference"
                    placeholder="e.g. 123456789012"
                    error={errors.upi_ref?.message}
                    hint="Find this in your UPI app's transaction history"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowUtrForm(false)}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      loading={markPaid.isPending}
                      leftIcon={markPaid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                    >
                      Submit Payment
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </DialogBody>

        {!showUtrForm && !paymentDone && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
              Close
            </Button>
          </DialogFooter>
        )}

        {paymentDone && (
          <DialogFooter>
            <Button onClick={handleClose} className="w-full sm:w-auto">
              Done
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
