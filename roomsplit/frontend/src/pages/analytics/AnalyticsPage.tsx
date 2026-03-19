import { useParams } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import {
  useAnalyticsSummary,
  usePaymentTrend,
  useMemberStandings,
  useExpenseBreakdown,
} from '@/api/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatINR } from '@/utils/currency'
import { BarChart2, TrendingUp, AlertCircle, Percent } from 'lucide-react'

const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

function StatCard({
  label,
  value,
  icon,
  colorClass,
}: {
  label: string
  value: string
  icon: React.ReactNode
  colorClass: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-surface-500 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const { groupId } = useParams<{ groupId: string }>()

  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary(groupId ?? '')
  const { data: trend, isLoading: trendLoading } = usePaymentTrend(groupId ?? '')
  const { data: standings, isLoading: standingsLoading } = useMemberStandings(groupId ?? '')
  const { data: expenseBreakdown } = useExpenseBreakdown(groupId ?? '')

  if (summaryLoading) return <FullPageSpinner />

  const trendData = (trend ?? []).map((t) => ({
    name: t.month,
    Collected: t.collected_rupees,
    Outstanding: t.outstanding_rupees,
  }))

  const pieData = (expenseBreakdown ?? []).map((e) => ({
    name: e.category,
    value: e.total_rupees,
    percentage: e.percentage,
  }))

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Analytics</h1>
        <p className="text-sm text-surface-500 mt-0.5">Rent collection and payment insights</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Collected This Month"
          value={summary ? formatINR(summary.total_collected_paise) : '—'}
          icon={<TrendingUp className="h-5 w-5 text-success-600" />}
          colorClass="text-success-700"
        />
        <StatCard
          label="Outstanding"
          value={summary ? formatINR(summary.outstanding_paise) : '—'}
          icon={<AlertCircle className="h-5 w-5 text-warning-600" />}
          colorClass="text-warning-700"
        />
        <StatCard
          label="Overdue Count"
          value={summary ? String(summary.overdue_count) : '—'}
          icon={<AlertCircle className="h-5 w-5 text-danger-600" />}
          colorClass="text-danger-700"
        />
        <StatCard
          label="Collection Rate"
          value={summary ? `${summary.collection_rate_percent}%` : '—'}
          icon={<Percent className="h-5 w-5 text-primary-600" />}
          colorClass="text-primary-700"
        />
      </div>

      {/* Monthly trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary-600" />
            Monthly Collection Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-sm text-surface-500">Loading chart...</p>
            </div>
          ) : !trend || trend.length === 0 ? (
            <EmptyState title="No trend data" description="Data will appear after a few cycles." className="py-12" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, '']}
                    contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="Collected" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense breakdown pie + member standings side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {!expenseBreakdown || expenseBreakdown.length === 0 ? (
              <EmptyState title="No expense data" description="Add expenses to see breakdown." className="py-12" />
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-48 w-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ percentage }) => `${percentage.toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']}
                        contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {pieData.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="text-sm capitalize text-surface-700">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-surface-900">
                        ₹{item.value.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Member standings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Member Standings</CardTitle>
          </CardHeader>
          <CardContent>
            {standingsLoading ? (
              <div className="text-center py-8 text-sm text-surface-500">Loading...</div>
            ) : !standings || standings.length === 0 ? (
              <EmptyState title="No standings data" className="py-12" />
            ) : (
              <div className="space-y-3">
                {standings.map((m) => (
                  <div
                    key={m.member_id}
                    className="flex items-center justify-between rounded-lg border border-surface-200 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-semibold shrink-0">
                        {m.member_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-surface-900">{m.member_name}</p>
                        <Badge
                          variant={m.status}
                          className="text-xs mt-0.5"
                        >
                          {m.status === 'good' ? 'Up to date' : m.status === 'overdue' ? 'Overdue' : 'Behind'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-success-700">
                        Paid: ₹{m.total_paid_rupees.toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-surface-500">
                        Owed: ₹{m.total_owed_rupees.toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-surface-400 mt-0.5">
                        {m.on_time_rate}% on-time
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
