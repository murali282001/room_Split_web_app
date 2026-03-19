import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, Plus, Trash2, RefreshCw, Check, Shield } from 'lucide-react'
import {
  useMembers,
  useRoles,
  useMutateAssignRole,
  useMutateRemoveMember,
  useMutateCreateRole,
  useMutateRefreshInvite,
} from '@/api/groups'
import { useGroup } from '@/api/groups'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/Dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/utils/date'
import { useToast } from '@/hooks/useToast'

const ALL_PERMISSIONS = [
  { key: 'group.settings', label: 'Edit Group Settings' },
  { key: 'cycle.create', label: 'Create Rent Cycles' },
  { key: 'cycle.activate', label: 'Activate/Close Cycles' },
  { key: 'payment.confirm', label: 'Confirm Payments' },
  { key: 'payment.reject', label: 'Reject Payments' },
  { key: 'member.remove', label: 'Remove Members' },
  { key: 'role.assign', label: 'Assign Roles' },
  { key: 'audit.view', label: 'View Audit Logs' },
  { key: 'wallet.withdraw', label: 'Request Withdrawals' },
  { key: 'expense.create', label: 'Create Expenses' },
  { key: 'expense.delete', label: 'Delete Expenses' },
]

const roleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters'),
})

type RoleFormData = z.infer<typeof roleSchema>

function CreateRoleModal({
  groupId,
  open,
  onClose,
}: {
  groupId: string
  open: boolean
  onClose: () => void
}) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const toast = useToast()
  const createRole = useMutateCreateRole(groupId)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
  })

  const togglePerm = (key: string) => {
    setPermissions((p) => ({ ...p, [key]: !p[key] }))
  }

  const onSubmit = async (data: RoleFormData) => {
    try {
      await createRole.mutateAsync({ name: data.name, permissions })
      toast.success('Role created!')
      reset()
      setPermissions({})
      onClose()
    } catch {
      toast.error('Failed to create role')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Custom Role</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <Input
              {...register('name')}
              label="Role Name"
              placeholder="e.g. Co-Admin"
              error={errors.name?.message}
              required
            />
            <div>
              <p className="text-sm font-medium text-surface-700 mb-3">Permissions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <label
                    key={perm.key}
                    className="flex items-center gap-2 rounded-md border border-surface-200 px-3 py-2 cursor-pointer hover:bg-surface-50"
                  >
                    <input
                      type="checkbox"
                      checked={!!permissions[perm.key]}
                      onChange={() => togglePerm(perm.key)}
                      className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-600"
                    />
                    <span className="text-sm text-surface-700">{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={createRole.isPending}>Create Role</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function MembersPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuthStore()
  const toast = useToast()
  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const [copiedInvite, setCopiedInvite] = useState(false)

  const { data: group, isLoading: groupLoading } = useGroup(groupId ?? '')
  const { data: members, isLoading: membersLoading } = useMembers(groupId ?? '')
  const { data: roles } = useRoles(groupId ?? '')

  const canAssignRole = usePermission(groupId ?? '', 'role.assign')
  const canRemoveMember = usePermission(groupId ?? '', 'member.remove')

  const assignRole = useMutateAssignRole(groupId ?? '')
  const removeMember = useMutateRemoveMember(groupId ?? '')
  const refreshInvite = useMutateRefreshInvite(groupId ?? '')

  const handleCopyInvite = async () => {
    if (!group?.invite_code) return
    await navigator.clipboard.writeText(group.invite_code)
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2000)
  }

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the group?`)) return
    try {
      await removeMember.mutateAsync(userId)
      toast.success(`${name} removed from group`)
    } catch {
      toast.error('Failed to remove member')
    }
  }

  const handleRefreshInvite = async () => {
    try {
      await refreshInvite.mutateAsync()
      toast.success('Invite code refreshed')
    } catch {
      toast.error('Failed to refresh invite code')
    }
  }

  if (membersLoading || groupLoading) return <FullPageSpinner />

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Members</h1>
        <p className="text-sm text-surface-500 mt-0.5">{group?.name}</p>
      </div>

      {/* Invite section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 rounded-lg bg-surface-50 border border-surface-200 px-4 py-3">
              <p className="text-xs text-surface-500 mb-1">Invite Code</p>
              <code className="font-mono text-sm font-bold text-surface-800">
                {group?.invite_code ?? '—'}
              </code>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                leftIcon={copiedInvite ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                onClick={handleCopyInvite}
              >
                {copiedInvite ? 'Copied!' : 'Copy Code'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={handleRefreshInvite}
                loading={refreshInvite.isPending}
              >
                Refresh
              </Button>
            </div>
          </div>
          <p className="text-xs text-surface-500">
            Share this code with your roommates. They can enter it on the Join page.
          </p>
        </CardContent>
      </Card>

      {/* Members table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Members ({members?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!members || members.length === 0 ? (
            <EmptyState
              icon={<Shield className="h-6 w-6" />}
              title="No members"
              description="Share the invite code to add members."
              className="py-12"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 border-b border-surface-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600 hidden sm:table-cell">Phone</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600">Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600 hidden md:table-cell">Joined</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600">Status</th>
                    {(canAssignRole || canRemoveMember) && (
                      <th className="text-right px-4 py-3 font-semibold text-surface-600">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => (
                    <tr key={m.user_id} className={i % 2 === 0 ? 'bg-white' : 'bg-surface-50/50'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
                            {m.user_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-surface-900">{m.user_name}</p>
                            {m.user_id === user?.id && (
                              <span className="text-xs text-primary-600">You</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-surface-600 hidden sm:table-cell">{m.user_phone}</td>
                      <td className="px-4 py-3">
                        {canAssignRole && roles && roles.length > 0 ? (
                          <Select
                            value={m.role_id}
                            onValueChange={async (roleId) => {
                              try {
                                await assignRole.mutateAsync({ userId: m.user_id, roleId })
                                toast.success('Role updated')
                              } catch {
                                toast.error('Failed to update role')
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="active" className="text-xs">{m.role_name}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-surface-500 text-xs hidden md:table-cell">
                        {formatDate(m.joined_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={m.status}>{m.status}</Badge>
                      </td>
                      {(canAssignRole || canRemoveMember) && (
                        <td className="px-4 py-3 text-right">
                          {canRemoveMember && m.user_id !== user?.id && m.user_id !== group?.created_by && (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="text-danger-500 hover:bg-danger-50"
                              onClick={() => handleRemoveMember(m.user_id, m.user_name)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roles section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Roles</CardTitle>
            {canAssignRole && (
              <Button
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setCreateRoleOpen(true)}
              >
                Create Role
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!roles || roles.length === 0 ? (
            <p className="text-sm text-surface-500">No roles configured.</p>
          ) : (
            <div className="space-y-3">
              {roles.map((role) => (
                <div key={role.id} className="rounded-lg border border-surface-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary-600" />
                      <span className="font-semibold text-surface-800">{role.name}</span>
                      {role.is_system && (
                        <Badge className="text-xs bg-surface-100 text-surface-500">System</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(role.permissions)
                      .filter(([, v]) => v)
                      .map(([k]) => {
                        const perm = ALL_PERMISSIONS.find((p) => p.key === k)
                        return (
                          <span
                            key={k}
                            className="rounded-full bg-primary-50 text-primary-700 text-xs px-2 py-0.5"
                          >
                            {perm?.label ?? k}
                          </span>
                        )
                      })}
                    {Object.values(role.permissions).every((v) => !v) && (
                      <span className="text-xs text-surface-400">No special permissions</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateRoleModal
        groupId={groupId ?? ''}
        open={createRoleOpen}
        onClose={() => setCreateRoleOpen(false)}
      />
    </div>
  )
}
