import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { User, Wallet } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useMutateUpdateProfile } from '@/api/auth'
import { useToast } from '@/hooks/useToast'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name is too long'),
  upi_id: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function ProfileSetupPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const updateProfile = useMutateUpdateProfile()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await updateProfile.mutateAsync({
        name: data.name,
        upi_id: data.upi_id || undefined,
      })
      toast.success('Profile saved!', 'Welcome to RoomSplit.')
      navigate('/dashboard', { replace: true })
    } catch {
      toast.error('Failed to save profile', 'Please try again.')
    }
  }

  const handleSkip = () => {
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-surface-100 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg mb-4">
            <span className="text-2xl font-bold text-white">RS</span>
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Complete Your Profile</h1>
          <p className="text-sm text-surface-500 mt-1">Let your roommates know who you are</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-lg border border-surface-100">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              {...register('name')}
              label="Full Name"
              placeholder="e.g. Rahul Sharma"
              error={errors.name?.message}
              leftAddon={<User className="h-4 w-4" />}
              required
            />

            <Input
              {...register('upi_id')}
              label="UPI ID"
              placeholder="e.g. rahul@upi"
              error={errors.upi_id?.message}
              leftAddon={<Wallet className="h-4 w-4" />}
              hint="Optional — used for sending payment receipts"
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={updateProfile.isPending}
            >
              Save & Continue
            </Button>

            <button
              type="button"
              className="w-full text-sm text-surface-500 hover:text-surface-700 py-1"
              onClick={handleSkip}
            >
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
