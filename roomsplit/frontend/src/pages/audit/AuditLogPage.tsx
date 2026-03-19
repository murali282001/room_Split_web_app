import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Shield, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { useAuditLogs } from '@/api/audit'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { SkeletonTable } from '@/components/ui/SkeletonCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDateTime } from '@/utils/date'
import { cn } from '@/utils/cn'
import { AuditLog } from '@/types/audit'

const ENTITY_TYPES = ['all', 'group', 'cycle', 'payment', 'member', 'role', 'wallet', 'expense']

function DiffView({ before, after }: { before?: Record<string, unknown>; after?: Record<string, unknown> }) {
  if (!before && !after) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
      {before && (
        <div className="rounded-md bg-danger-50 border border-danger-100 p-3">
          <p className="text-xs font-semibold text-danger-600 mb-1">Before</p>
          <pre className="text-xs text-danger-800 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(before, null, 2)}
          </pre>
        </div>
      )}
      {after && (
        <div className="rounded-md bg-success-50 border border-success-100 p-3">
          <p className="text-xs font-semibold text-success-600 mb-1">After</p>
          <pre className="text-xs text-success-800 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(after, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function AuditRow({ log, index }: { log: AuditLog; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const hasDiff = log.before_state || log.after_state

  const actionColor =
    log.action.includes('creat') ? 'text-success-700 bg-success-50' :
    log.action.includes('delet') ? 'text-danger-700 bg-danger-50' :
    log.action.includes('updat') || log.action.includes('edit') ? 'text-blue-700 bg-blue-50' :
    'text-surface-700 bg-surface-100'

  return (
    <>
      <tr
        className={cn(
          'border-b border-surface-100 hover:bg-surface-50 transition-colors',
          index % 2 === 0 ? 'bg-white' : 'bg-surface-50/50'
        )}
      >
        <td className="px-4 py-3 text-xs text-surface-400 font-mono whitespace-nowrap">
          #{log.id}
        </td>
        <td className="px-4 py-3 text-xs text-surface-500 whitespace-nowrap">
          {formatDateTime(log.created_at)}
        </td>
        <td className="px-4 py-3">
          <div>
            <p className="font-medium text-surface-900 text-sm">{log.actor_name ?? 'System'}</p>
            {log.actor_phone && (
              <p className="text-xs text-surface-400">{log.actor_phone}</p>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', actionColor)}>
            {log.action}
          </span>
        </td>
        <td className="px-4 py-3 hidden sm:table-cell">
          <span className="text-xs text-surface-600 capitalize">{log.entity_type}</span>
        </td>
        <td className="px-4 py-3 text-xs font-mono text-surface-400 hidden md:table-cell">
          {log.entity_id.slice(0, 8)}…
        </td>
        <td className="px-4 py-3">
          {hasDiff && (
            <button
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Hide' : 'Details'}
            </button>
          )}
        </td>
      </tr>
      {expanded && hasDiff && (
        <tr className="bg-surface-50">
          <td colSpan={7} className="px-4 py-3">
            <DiffView before={log.before_state} after={log.after_state} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function AuditLogPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [entityType, setEntityType] = useState('all')
  const [actorSearch, setActorSearch] = useState('')
  const [page, setPage] = useState(1)

  const canView = usePermission(groupId ?? '', 'audit.view')

  const { data, isLoading } = useAuditLogs(groupId ?? '', {
    entity_type: entityType === 'all' ? undefined : entityType,
    actor_name: actorSearch || undefined,
    page,
    page_size: 25,
  })

  if (!canView) {
    return <Navigate to={`/groups/${groupId}`} replace />
  }

  const logs = data?.items ?? []

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Audit Log</h1>
        <p className="text-sm text-surface-500 mt-0.5">
          {data?.total ?? 0} events recorded
        </p>
      </div>

      {/* Immutability notice */}
      <div className="flex items-start gap-3 rounded-lg bg-primary-50 border border-primary-100 p-4">
        <Shield className="h-5 w-5 text-primary-600 shrink-0 mt-0.5" />
        <p className="text-sm text-primary-700">
          <span className="font-semibold">Audit logs are immutable and tamper-resistant.</span>{' '}
          All actions are cryptographically recorded and cannot be modified or deleted.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white rounded-lg border border-surface-200 p-4">
        <Filter className="h-4 w-4 text-surface-400 mt-2.5 shrink-0" />
        <Input
          placeholder="Search by actor name..."
          value={actorSearch}
          onChange={(e) => { setActorSearch(e.target.value); setPage(1) }}
          className="w-44"
        />
        <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((e) => (
              <SelectItem key={e} value={e} className="capitalize">{e === 'all' ? 'All Types' : e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-surface-200 overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={10} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<Shield className="h-6 w-6" />}
            title="No audit logs"
            description="Activity will be recorded here."
            className="py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 w-12">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600">Time</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600">Actor</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600">Action</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 hidden sm:table-cell">Entity</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 hidden md:table-cell">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <AuditRow key={log.id} log={log} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-surface-600">Page {data.page} of {data.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
