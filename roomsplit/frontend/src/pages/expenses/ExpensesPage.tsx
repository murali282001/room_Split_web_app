import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Receipt, Trash2 } from 'lucide-react'
import { useExpenses, useMutateCreateExpense, useMutateDeleteExpense } from '@/api/expenses'
import { useMembers } from '@/api/groups'
import { usePermission } from '@/hooks/usePermission'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/Dialog'
import { SkeletonCard } from '@/components/ui/SkeletonCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatINR } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import { useToast } from '@/hooks/useToast'
import { Expense } from '@/types/expense'

const CATEGORIES = ['utilities', 'groceries', 'maintenance', 'internet', 'other']

const expenseSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  category: z.string().optional(),
  total_amount_rupees: z.number().positive('Amount must be positive'),
  split_type: z.enum(['equal', 'custom']),
  expense_date: z.string().min(1, 'Date is required'),
})

type ExpenseFormData = z.infer<typeof expenseSchema>

const categoryColors: Record<string, string> = {
  utilities: 'bg-blue-100 text-blue-700',
  groceries: 'bg-green-100 text-green-700',
  maintenance: 'bg-orange-100 text-orange-700',
  internet: 'bg-purple-100 text-purple-700',
  other: 'bg-surface-100 text-surface-600',
}

function AddExpenseModal({
  groupId,
  open,
  onClose,
}: {
  groupId: string
  open: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const createExpense = useMutateCreateExpense(groupId)
  const { data: members } = useMembers(groupId)
  const [category, setCategory] = useState('other')
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal')
  const [memberAmounts, setMemberAmounts] = useState<Record<string, string>>({})

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { split_type: 'equal', category: 'other' },
  })

  const onSubmit = async (data: ExpenseFormData) => {
    try {
      const payload: Parameters<typeof createExpense.mutateAsync>[0] = {
        title: data.title,
        category,
        total_amount: data.total_amount_rupees,
        split_type: splitType,
        expense_date: data.expense_date,
      }
      if (splitType === 'custom') {
        payload.members = Object.entries(memberAmounts).map(([member_id, amt]) => ({
          member_id,
          amount: parseFloat(amt) || 0,
        }))
      }
      await createExpense.mutateAsync(payload)
      toast.success('Expense added!')
      reset()
      setMemberAmounts({})
      onClose()
    } catch {
      toast.error('Failed to add expense')
    }
  }

  const handleClose = () => {
    reset()
    setMemberAmounts({})
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <Input
              {...register('title')}
              label="Expense Title"
              placeholder="e.g. Electricity bill"
              error={errors.title?.message}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-surface-700">Category</label>
              <Select value={category} onValueChange={(v) => { setCategory(v); setValue('category', v) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              {...register('total_amount_rupees', { valueAsNumber: true })}
              label="Amount (₹)"
              type="number"
              min={0}
              step={0.01}
              placeholder="e.g. 2500"
              error={errors.total_amount_rupees?.message}
              required
            />
            <Input
              {...register('expense_date')}
              label="Expense Date"
              type="date"
              error={errors.expense_date?.message}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-surface-700">Split Type</label>
              <Select
                value={splitType}
                onValueChange={(v) => {
                  const t = v as 'equal' | 'custom'
                  setSplitType(t)
                  setValue('split_type', t)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Equal Split</SelectItem>
                  <SelectItem value="custom">Custom Split</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {splitType === 'custom' && members && members.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Amount per member (₹)</label>
                <p className="text-xs text-surface-500">Amounts must sum to the total above.</p>
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-3">
                    <span className="text-sm text-surface-700 w-28 shrink-0 truncate">{m.user_name}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="flex-1 h-9 rounded-md border border-surface-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="0.00"
                      value={memberAmounts[m.user_id] ?? ''}
                      onChange={(e) => setMemberAmounts((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" loading={createExpense.isPending}>Add Expense</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ExpenseItem({
  expense,
  groupId,
  canDelete,
}: {
  expense: Expense
  groupId: string
  canDelete: boolean
}) {
  const toast = useToast()
  const deleteExpense = useMutateDeleteExpense(groupId, expense.id)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-surface-900">{expense.title}</h3>
              {expense.category && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${categoryColors[expense.category] ?? 'bg-surface-100 text-surface-600'}`}>
                  {expense.category}
                </span>
              )}
              <Badge variant={expense.status}>{expense.status}</Badge>
            </div>
            <p className="text-2xl font-bold text-surface-900 mt-1">
              {formatINR(expense.total_amount_paise)}
            </p>
            <p className="text-xs text-surface-500 mt-1">
              {formatDate(expense.expense_date)} · {expense.split_type === 'equal' ? 'Equal split' : 'Custom split'} · {expense.splits.length} members
            </p>
          </div>
          {canDelete && (
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-danger-500 hover:bg-danger-50 shrink-0"
              onClick={async () => {
                if (!confirm('Delete this expense?')) return
                try {
                  await deleteExpense.mutateAsync()
                  toast.success('Expense deleted')
                } catch {
                  toast.error('Failed to delete expense')
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Splits */}
        {expense.splits.length > 0 && (
          <div className="mt-3 border-t border-surface-100 pt-3">
            <div className="flex flex-wrap gap-2">
              {expense.splits.map((split) => (
                <div
                  key={split.id}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${split.is_settled ? 'bg-success-100 text-success-700' : 'bg-surface-100 text-surface-600'}`}
                >
                  <span>{split.member_name}</span>
                  <span className="font-semibold">₹{split.owed_amount_rupees}</span>
                  {split.is_settled && <span>✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ExpensesPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [addOpen, setAddOpen] = useState(false)

  const canCreate = usePermission(groupId ?? '', 'expense.create')
  const canDelete = usePermission(groupId ?? '', 'expense.delete')

  const { data, isLoading } = useExpenses(groupId ?? '')
  const expenses = data?.items ?? []

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Expenses</h1>
          <p className="text-sm text-surface-500 mt-0.5">{expenses.length} expenses</p>
        </div>
        {canCreate && (
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setAddOpen(true)}
          >
            Add Expense
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="No expenses yet"
          description="Track shared expenses for your household."
          action={canCreate ? { label: 'Add Expense', onClick: () => setAddOpen(true) } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <ExpenseItem
              key={expense.id}
              expense={expense}
              groupId={groupId ?? ''}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}

      <AddExpenseModal
        groupId={groupId ?? ''}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </div>
  )
}
