import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, CreditCard, Clock, Plus, LogIn, TrendingUp, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useGroups } from '@/api/groups'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/SkeletonCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatINR } from '@/utils/currency'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useMutateJoinGroup } from '@/api/groups'
import { useToast } from '@/hooks/useToast'
import CreateGroupModal from '../groups/CreateGroupModal'

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-surface-500">{label}</p>
            <p className="text-2xl font-bold text-surface-900 mt-1">{value}</p>
            {sub && <p className="text-xs text-surface-500 mt-1">{sub}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function JoinGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [inviteCode, setInviteCode] = useState('')
  const join = useMutateJoinGroup()
  const toast = useToast()
  const navigate = useNavigate()

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    try {
      const group = await join.mutateAsync(inviteCode.trim())
      toast.success('Joined group!', `Welcome to ${group.name}`)
      onClose()
      navigate(`/groups/${group.id}`)
    } catch {
      toast.error('Failed to join group', 'Invalid or expired invite code.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a Group</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Input
            label="Invite Code"
            placeholder="Enter invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleJoin} loading={join.isPending}>Join Group</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { data: groups, isLoading } = useGroups()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)

  const groupCount = groups?.length ?? 0

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">
            Welcome back, {user?.name?.split(' ')[0] ?? 'there'}!
          </h1>
          <p className="text-surface-500 text-sm mt-0.5">Here's your rent overview</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<LogIn className="h-4 w-4" />}
            onClick={() => setJoinOpen(true)}
          >
            Join Group
          </Button>
          <Button
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Create Group
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Users className="h-5 w-5 text-primary-600" />}
          label="My Groups"
          value={groupCount}
          color="bg-primary-100"
        />
        <StatCard
          icon={<CreditCard className="h-5 w-5 text-warning-600" />}
          label="Pending Payments"
          value={0}
          sub="Nothing due right now"
          color="bg-warning-100"
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-danger-600" />}
          label="Due This Week"
          value={0}
          sub="All clear"
          color="bg-danger-100"
        />
      </div>

      {/* Groups list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-surface-900">My Groups</h2>
          <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate('/groups')}>
            View all
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : !groups || groups.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No groups yet"
            description="Create a group with your roommates or join one with an invite code."
            action={{ label: 'Create Group', onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="cursor-pointer hover:shadow-md transition-all hover:border-primary-200"
                onClick={() => navigate(`/groups/${group.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                      <span className="text-lg font-bold text-primary-700">
                        {group.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <Badge variant={group.is_active ? 'active' : 'closed'}>
                      {group.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <CardTitle className="mt-2">{group.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-surface-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {group.member_count ?? 0} members
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {group.cycle_type === 'monthly' ? 'Monthly' : 'Custom'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-3 text-primary-600 hover:bg-primary-50"
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    View Group
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinGroupModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  )
}
