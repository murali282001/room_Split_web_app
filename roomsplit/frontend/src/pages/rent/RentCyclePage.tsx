import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Calendar, ArrowRight } from 'lucide-react'
import { useCycles, useMutateCreateCycle } from '@/api/rent'
import { usePermission } from '@/hooks/usePermission'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SkeletonCard } from '@/components/ui/SkeletonCard'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { formatDate } from '@/utils/date'
import { formatINR } from '@/utils/currency'
import { useToast } from '@/hooks/useToast'
import { RentCycle } from '@/types/payment'

const cycleSchema = z.object({
  label: z.string().min(2, 'Label is required'),
  period_start: z.string().min(1, 'Start date required'),
  period_end: z.string().min(1, 'End date required'),
  total_amount_rupees: z.number().positive('Amount must be positive'),
  due_date: z.string().min(1, 'Due date required'),
})

type CycleFormData = z.infer<typeof cycleSchema>

function CycleCard({ cycle, groupId }: { cycle: RentCycle; groupId: string }) {
  const navigate = useNavigate()

  const statusVariant = {
    draft: 'draft' as const,
    active: 'active' as const,
    closed: 'closed' as const,
    cancelled: 'cancelled' as const,
  }[cycle.status]

  return (
    <Card className="hover:shadow-md transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-surface-900">{cycle.label}</h3>
            <p className="text-sm text-surface-500 mt-0.5">
              {formatDate(cycle.period_start)} – {formatDate(cycle.period_end)}
            </p>
          </div>
          <Badge variant={statusVariant} className="shrink-0 capitalize">
            {cycle.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-600">Total rent:</span>
          <span className="font-bold text-surface-900">{formatINR(cycle.total_amount_paise)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-600">Due date:</span>
          <span className="text-surface-700">{formatDate(cycle.due_date)}</span>
        </div>
        {cycle.status === 'active' && (
          <ProgressBar collected={0} target={cycle.total_amount_paise} showLabels={false} size="sm" />
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          rightIcon={<ArrowRight className="h-4 w-4" />}
          onClick={() => navigate(`/groups/${groupId}/rent/${cycle.id}`)}
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  )
}

function CreateCycleModal({
  groupId,
  open,
  onClose,
}: {
  groupId: string
  open: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const createCycle = useMutateCreateCycle(groupId)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CycleFormData>({
    resolver: zodResolver(cycleSchema),
  })

  const onSubmit = async (data: CycleFormData) => {
    try {
      await createCycle.mutateAsync({
        label: data.label,
        period_start: data.period_start,
        period_end: data.period_end,
        total_amount: data.total_amount_rupees,
        due_date: data.due_date,
      })
      toast.success('Cycle created!')
      reset()
      onClose()
    } catch {
      toast.error('Failed to create cycle')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Rent Cycle</DialogTitle>
          <DialogDescription>Set up a new rent collection cycle</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <Input
              {...register('label')}
              label="Cycle Label"
              placeholder="e.g. January 2025"
              error={errors.label?.message}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                {...register('period_start')}
                label="Period Start"
                type="date"
                error={errors.period_start?.message}
                required
              />
              <Input
                {...register('period_end')}
                label="Period End"
                type="date"
                error={errors.period_end?.message}
                required
              />
            </div>
            <Input
              {...register('total_amount_rupees', { valueAsNumber: true })}
              label="Total Rent Amount (₹)"
              type="number"
              min={0}
              step={0.01}
              placeholder="e.g. 25000"
              error={errors.total_amount_rupees?.message}
              required
            />
            <Input
              {...register('due_date')}
              label="Due Date"
              type="date"
              error={errors.due_date?.message}
              required
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={createCycle.isPending}>Create Cycle</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function RentCyclePage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [createOpen, setCreateOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const canCreate = usePermission(groupId ?? '', 'cycle.create')
  const { data, isLoading } = useCycles(groupId ?? '', {
    status: statusFilter === 'all' ? undefined : statusFilter,
  })

  const cycles = data?.items ?? []

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Rent Cycles</h1>
          <p className="text-sm text-surface-500 mt-0.5">{cycles.length} cycles</p>
        </div>
        {canCreate && (
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Create Cycle
          </Button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {['all', 'active', 'draft', 'closed', 'cancelled'].map((s) => (
          <button
            key={s}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors capitalize ${
              statusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : cycles.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="No cycles found"
          description={canCreate ? 'Create your first rent cycle.' : 'No rent cycles have been created yet.'}
          action={canCreate ? { label: 'Create Cycle', onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cycles.map((cycle) => (
            <CycleCard key={cycle.id} cycle={cycle} groupId={groupId ?? ''} />
          ))}
        </div>
      )}

      <CreateCycleModal
        groupId={groupId ?? ''}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}
