import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Wallet, TrendingUp, TrendingDown, Plus } from 'lucide-react'
import {
  useWallet,
  useWalletTransactions,
  useWithdrawals,
  useMutateRequestWithdrawal,
} from '@/api/wallet'
import { useCycles } from '@/api/rent'
import { useMembers } from '@/api/groups'
import { usePermission } from '@/hooks/usePermission'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Input } from '@/components/ui/Input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/Dialog'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatINR } from '@/utils/currency'
import { formatDateTime } from '@/utils/date'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/utils/cn'

const withdrawSchema = z.object({
  amount_rupees: z.number().positive('Amount must be positive'),
  reason: z.string().optional(),
})

type WithdrawFormData = z.infer<typeof withdrawSchema>

function WithdrawalModal({
  groupId,
  maxBalance,
  open,
  onClose,
}: {
  groupId: string
  maxBalance: number
  open: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const requestWithdrawal = useMutateRequestWithdrawal(groupId)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<WithdrawFormData>({
    resolver: zodResolver(withdrawSchema),
  })

  const onSubmit = async (data: WithdrawFormData) => {
    try {
      await requestWithdrawal.mutateAsync({
        amount: data.amount_rupees,
        reason: data.reason,
      })
      toast.success('Withdrawal requested!')
      reset()
      onClose()
    } catch {
      toast.error('Failed to request withdrawal')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Withdrawal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <div className="rounded-lg bg-surface-50 border border-surface-200 p-3 text-sm">
              Available balance: <span className="font-bold">{formatINR(maxBalance)}</span>
            </div>
            <Input
              {...register('amount_rupees', { valueAsNumber: true })}
              label="Amount (₹)"
              type="number"
              min={0}
              step={0.01}
              placeholder="e.g. 5000"
              error={errors.amount_rupees?.message}
              required
            />
            <Input
              {...register('reason')}
              label="Reason (optional)"
              placeholder="e.g. Monthly rent payout"
              error={errors.reason?.message}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={requestWithdrawal.isPending}>Request Withdrawal</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function WalletPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  const canWithdraw = usePermission(groupId ?? '', 'wallet.withdraw')

  const { data: wallet, isLoading: walletLoading } = useWallet(groupId ?? '')
  const { data: transactions } = useWalletTransactions(groupId ?? '', { page_size: 20 })
  const { data: withdrawals } = useWithdrawals(groupId ?? '')
  const { data: cyclesPage } = useCycles(groupId ?? '', { status: 'active', page_size: 1 })
  const activeCycle = cyclesPage?.items?.[0]

  if (walletLoading) return <FullPageSpinner />

  const txList = transactions?.items ?? []
  const withdrawalList = withdrawals ?? []

  const withdrawalStatusVariant = (status: string) => {
    if (status === 'completed') return 'confirmed' as const
    if (status === 'approved') return 'active' as const
    if (status === 'rejected') return 'rejected' as const
    return 'pending' as const
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-surface-900">Wallet</h1>

      {/* Balance card */}
      <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white border-0">
        <CardContent className="p-6">
          <p className="text-primary-200 text-sm font-medium mb-2">Group Wallet Balance</p>
          <p className="text-4xl font-bold">
            {wallet ? formatINR(wallet.balance_paise) : '—'}
          </p>
          {wallet?.last_updated_at && (
            <p className="text-primary-200 text-xs mt-2">
              Updated {formatDateTime(wallet.last_updated_at)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Active cycle progress */}
      {activeCycle && wallet && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Cycle Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressBar
              collected={wallet.balance_paise}
              target={activeCycle.total_amount_paise}
            />
            <p className="text-xs text-surface-500 mt-2">
              {activeCycle.label} · Due {activeCycle.due_date}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Withdrawal section */}
      {canWithdraw && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Withdrawals</CardTitle>
              <Button
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setWithdrawOpen(true)}
              >
                Request Withdrawal
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {withdrawalList.length === 0 ? (
              <EmptyState
                title="No withdrawals"
                description="Request a withdrawal to transfer funds."
                className="py-8"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-surface-200">
                    <tr>
                      <th className="text-left py-2 pr-4 font-semibold text-surface-600">Requested By</th>
                      <th className="text-left py-2 pr-4 font-semibold text-surface-600">Amount</th>
                      <th className="text-left py-2 pr-4 font-semibold text-surface-600">UPI</th>
                      <th className="text-left py-2 pr-4 font-semibold text-surface-600">Status</th>
                      <th className="text-left py-2 font-semibold text-surface-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawalList.map((w) => (
                      <tr key={w.id} className="border-b border-surface-100">
                        <td className="py-2.5 pr-4 text-surface-800">{w.requested_by_name}</td>
                        <td className="py-2.5 pr-4 font-semibold">{formatINR(w.amount_paise)}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-surface-600">{w.destination_upi}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={withdrawalStatusVariant(w.status)} className="capitalize">{w.status}</Badge>
                        </td>
                        <td className="py-2.5 text-xs text-surface-500">{formatDateTime(w.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {txList.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              description="Wallet activity will appear here."
              className="py-8"
            />
          ) : (
            <div className="space-y-0">
              {txList.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full shrink-0',
                      tx.transaction_type === 'credit' ? 'bg-success-100' : 'bg-danger-100'
                    )}>
                      {tx.transaction_type === 'credit' ? (
                        <TrendingUp className="h-4 w-4 text-success-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-danger-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-800">
                        {tx.description ?? (tx.transaction_type === 'credit' ? 'Credit' : 'Debit')}
                      </p>
                      <p className="text-xs text-surface-400">{formatDateTime(tx.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'font-bold',
                      tx.transaction_type === 'credit' ? 'text-success-700' : 'text-danger-700'
                    )}>
                      {tx.transaction_type === 'credit' ? '+' : '-'}{formatINR(tx.amount_paise)}
                    </p>
                    <p className="text-xs text-surface-400">Bal: ₹{tx.balance_after_rupees}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {wallet && (
        <WithdrawalModal
          groupId={groupId ?? ''}
          maxBalance={wallet.balance_paise}
          open={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
        />
      )}
    </div>
  )
}
