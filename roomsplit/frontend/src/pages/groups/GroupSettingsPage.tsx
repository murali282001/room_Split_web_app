import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle } from 'lucide-react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { useGroup, useMutateUpdateGroup, useMutateDeleteGroup } from '@/api/groups'
import { usePermission } from '@/hooks/usePermission'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/utils/cn'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().optional(),
  rent_collection_upi: z.string().min(5, 'Enter a valid UPI ID'),
})

type FormData = z.infer<typeof schema>

export default function GroupSettingsPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const canEdit = usePermission(groupId ?? '', 'group.settings')
  const { data: group, isLoading } = useGroup(groupId ?? '')
  const updateGroup = useMutateUpdateGroup(groupId ?? '')
  const deleteGroup = useMutateDeleteGroup(groupId ?? '')

  const [autoConfirm, setAutoConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (group) {
      reset({
        name: group.name,
        description: group.description ?? '',
        rent_collection_upi: group.rent_collection_upi,
      })
      setAutoConfirm(group.auto_confirm_payments)
    }
  }, [group, reset])

  if (isLoading) return <FullPageSpinner />
  if (!group) return null

  if (!canEdit) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="rounded-lg bg-danger-50 border border-danger-200 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-danger-500 mx-auto mb-3" />
          <p className="font-semibold text-danger-700">Access Denied</p>
          <p className="text-sm text-danger-600 mt-1">
            You don't have permission to edit group settings.
          </p>
        </div>
      </div>
    )
  }

  const onSubmit = async (data: FormData) => {
    try {
      await updateGroup.mutateAsync({
        ...data,
        auto_confirm_payments: autoConfirm,
      })
      toast.success('Settings saved!')
    } catch {
      toast.error('Failed to save settings')
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Group Settings</h1>
        <p className="text-sm text-surface-500 mt-0.5">{group.name}</p>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Update group name, description, and collection UPI</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              {...register('name')}
              label="Group Name"
              error={errors.name?.message}
              required
            />
            <Input
              {...register('description')}
              label="Description"
              error={errors.description?.message}
            />
            <Input
              {...register('rent_collection_upi')}
              label="Rent Collection UPI ID"
              error={errors.rent_collection_upi?.message}
              hint="All rent payments will be sent to this UPI ID"
              required
            />

            {/* Auto-confirm toggle */}
            <div className="flex items-start justify-between rounded-lg border border-surface-200 p-4">
              <div className="flex-1 pr-4">
                <p className="text-sm font-semibold text-surface-800">Auto-confirm payments</p>
                <p className="text-xs text-surface-500 mt-1">
                  Members' payments are auto-confirmed without admin review
                </p>
              </div>
              <SwitchPrimitive.Root
                checked={autoConfirm}
                onCheckedChange={setAutoConfirm}
                className={cn(
                  'relative inline-flex h-6 w-11 cursor-pointer rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2',
                  autoConfirm ? 'bg-primary-600' : 'bg-surface-300'
                )}
              >
                <SwitchPrimitive.Thumb
                  className={cn(
                    'block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                    autoConfirm ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </SwitchPrimitive.Root>
            </div>

            <Button
              type="submit"
              loading={updateGroup.isPending}
              disabled={!isDirty && autoConfirm === group.auto_confirm_payments}
            >
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-danger-200">
        <CardHeader>
          <CardTitle className="text-danger-700 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions. Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-danger-200 bg-danger-50 p-4">
            <div>
              <p className="text-sm font-semibold text-danger-800">Delete Group</p>
              <p className="text-xs text-danger-600 mt-0.5">
                This will permanently delete the group and all its data.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              loading={deleteGroup.isPending}
              onClick={async () => {
                if (!confirm('Are you sure? This will permanently delete the group and all its data.')) return
                try {
                  await deleteGroup.mutateAsync()
                  navigate('/groups')
                } catch {
                  toast.error('Failed to delete group')
                }
              }}
            >
              Delete Group
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
