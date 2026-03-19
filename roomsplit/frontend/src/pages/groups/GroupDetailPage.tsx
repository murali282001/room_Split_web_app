import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Copy, Check, Users, Calendar, CreditCard, ArrowRight } from 'lucide-react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { useGroup, useMembers } from '@/api/groups'
import { useCycles } from '@/api/rent'
import { usePayments } from '@/api/payments'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { PaymentStatusBadge } from '@/components/payments/PaymentStatusBadge'
import { PaymentCard } from '@/components/payments/PaymentCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/utils/date'
import { formatINR } from '@/utils/currency'
import { cn } from '@/utils/cn'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data: group, isLoading: groupLoading } = useGroup(groupId ?? '')
  const { data: members } = useMembers(groupId ?? '')
  const { data: cyclesPage } = useCycles(groupId ?? '', { page_size: 1, status: 'active' })
  const activeCycle = cyclesPage?.items?.[0]

  const { data: paymentsPage } = usePayments(groupId ?? '', { page_size: 5 })
  const recentPayments = paymentsPage?.items ?? []

  const myPayment = recentPayments.find((p) => p.payer_id === user?.id)
  const confirmedPaise = recentPayments
    .filter((p) => p.status === 'confirmed' && p.cycle_id === activeCycle?.id)
    .reduce((sum, p) => sum + p.amount_paise, 0)

  if (groupLoading) return <FullPageSpinner />
  if (!group) return null

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-xl font-bold text-primary-700">
              {group.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900">{group.name}</h1>
              {group.description && (
                <p className="text-sm text-surface-500 mt-0.5">{group.description}</p>
              )}
            </div>
          </div>
          {group.invite_code && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-50 border border-surface-200 px-3 py-2 w-fit">
              <span className="text-xs text-surface-500">Invite code:</span>
              <code className="text-xs font-mono font-semibold text-surface-800">{group.invite_code}</code>
              <CopyButton text={group.invite_code} />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/groups/${groupId}/members`)}
            leftIcon={<Users className="h-4 w-4" />}
          >
            {members?.length ?? 0} Members
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <TabsPrimitive.Root defaultValue="overview">
        <TabsPrimitive.List className="flex gap-1 rounded-lg bg-surface-100 p-1 mb-6">
          {['overview', 'members'].map((tab) => (
            <TabsPrimitive.Trigger
              key={tab}
              value={tab}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors capitalize',
                'data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm',
                'text-surface-600 hover:text-surface-900'
              )}
            >
              {tab}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        {/* Overview Tab */}
        <TabsPrimitive.Content value="overview" className="space-y-6">
          {/* Active cycle */}
          {activeCycle ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary-600" />
                    Active Cycle: {activeCycle.label}
                  </CardTitle>
                  <Badge variant="active">Active</Badge>
                </div>
                <p className="text-sm text-surface-500">
                  {formatDate(activeCycle.period_start)} – {formatDate(activeCycle.period_end)} · Due {formatDate(activeCycle.due_date)}
                </p>
              </CardHeader>
              <CardContent>
                <ProgressBar
                  collected={confirmedPaise}
                  target={activeCycle.total_amount_paise}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-primary-600"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                  onClick={() => navigate(`/groups/${groupId}/rent/${activeCycle.id}`)}
                >
                  View Cycle Details
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="h-8 w-8 text-surface-300 mx-auto mb-2" />
                <p className="text-surface-500 text-sm">No active rent cycle</p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate(`/groups/${groupId}/rent`)}
                >
                  Manage Cycles
                </Button>
              </CardContent>
            </Card>
          )}

          {/* My payment status */}
          {myPayment && (
            <Card className="border-l-4 border-l-primary-400">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-5 w-5 text-primary-600" />
                  My Payment Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-surface-900">{formatINR(myPayment.amount_paise)}</p>
                    {myPayment.due_date && (
                      <p className="text-xs text-surface-500 mt-1">Due: {formatDate(myPayment.due_date)}</p>
                    )}
                  </div>
                  <PaymentStatusBadge status={myPayment.status} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent payments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-surface-900">Recent Payments</h3>
              <Button
                variant="ghost"
                size="sm"
                rightIcon={<ArrowRight className="h-4 w-4" />}
                onClick={() => navigate(`/groups/${groupId}/payments`)}
              >
                View all
              </Button>
            </div>
            {recentPayments.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="h-5 w-5" />}
                title="No payments yet"
                description="Payments will appear here once the first cycle is active."
              />
            ) : (
              <div className="space-y-3">
                {recentPayments.slice(0, 5).map((p) => (
                  <PaymentCard key={p.id} payment={p} />
                ))}
              </div>
            )}
          </div>
        </TabsPrimitive.Content>

        {/* Members Tab */}
        <TabsPrimitive.Content value="members">
          {!members || members.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No members"
              description="Invite members using the invite code."
            />
          ) : (
            <div className="rounded-lg border border-surface-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 border-b border-surface-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600 hidden sm:table-cell">Phone</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600">Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600 hidden md:table-cell">Joined</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => (
                    <tr key={m.user_id} className={i % 2 === 0 ? 'bg-white' : 'bg-surface-50'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-semibold shrink-0">
                            {m.user_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-surface-900">{m.user_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-surface-600 hidden sm:table-cell">{m.user_phone}</td>
                      <td className="px-4 py-3">
                        <Badge variant="active" className="text-xs">{m.role_name}</Badge>
                      </td>
                      <td className="px-4 py-3 text-surface-500 hidden md:table-cell">{formatDate(m.joined_at)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={m.status}>{m.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>
    </div>
  )
}
