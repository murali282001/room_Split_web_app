import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useMutateCreateGroup } from '@/api/groups'
import { useToast } from '@/hooks/useToast'
import { useState } from 'react'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().optional(),
  rent_collection_upi: z.string().min(5, 'Enter a valid UPI ID'),
  cycle_type: z.enum(['monthly', 'custom']),
  cycle_day: z.preprocess(
    (v) => (typeof v === 'number' && isNaN(v) ? undefined : v),
    z.number().int().min(1).max(28).optional()
  ),
})

type FormData = z.infer<typeof schema>

interface CreateGroupModalProps {
  open: boolean
  onClose: () => void
}

export default function CreateGroupModal({ open, onClose }: CreateGroupModalProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const createGroup = useMutateCreateGroup()
  const [cycleType, setCycleType] = useState<'monthly' | 'custom'>('monthly')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    unregister,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { cycle_type: 'monthly' },
  })

  const onSubmit = async (data: FormData) => {
    try {
      const group = await createGroup.mutateAsync(data)
      toast.success('Group created!', `${group.name} is ready.`)
      reset()
      onClose()
      navigate(`/groups/${group.id}`)
    } catch {
      toast.error('Failed to create group')
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription>
            Set up a rent-splitting group for your household
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <Input
              {...register('name')}
              label="Group Name"
              placeholder="e.g. Flat 4B Residents"
              error={errors.name?.message}
              required
            />

            <Input
              {...register('description')}
              label="Description"
              placeholder="Optional description"
              error={errors.description?.message}
            />

            <Input
              {...register('rent_collection_upi')}
              label="Rent Collection UPI ID"
              placeholder="e.g. landlord@upi"
              error={errors.rent_collection_upi?.message}
              hint="Payments will be collected to this UPI ID"
              required
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-surface-700">
                Cycle Type <span className="text-danger-600">*</span>
              </label>
              <Select
                value={cycleType}
                onValueChange={(v) => {
                  const type = v as 'monthly' | 'custom'
                  setCycleType(type)
                  setValue('cycle_type', type)
                  if (type === 'custom') {
                    unregister('cycle_day')
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cycle type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {cycleType === 'monthly' && (
              <Input
                {...register('cycle_day', { valueAsNumber: true })}
                label="Billing Day of Month"
                type="number"
                min={1}
                max={28}
                placeholder="e.g. 1 (for 1st of each month)"
                error={errors.cycle_day?.message}
                hint="Day of the month when rent is due (1–28)"
              />
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createGroup.isPending}>
              Create Group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
