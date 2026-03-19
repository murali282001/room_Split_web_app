import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Calendar, ArrowRight } from 'lucide-react'
import { useGroups } from '@/api/groups'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/SkeletonCard'
import { EmptyState } from '@/components/ui/EmptyState'
import CreateGroupModal from './CreateGroupModal'

export default function GroupListPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const navigate = useNavigate()
  const { data: groups, isLoading } = useGroups()

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">My Groups</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            {groups?.length ?? 0} group{(groups?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setCreateOpen(true)}
        >
          Create Group
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : !groups || groups.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No groups yet"
          description="Create a group or ask your roommate to share an invite link."
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
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-xl font-bold text-primary-700">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <Badge variant={group.is_active ? 'active' : 'closed'}>
                    {group.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <CardTitle className="mt-3 line-clamp-1">{group.name}</CardTitle>
                {group.description && (
                  <p className="text-sm text-surface-500 line-clamp-2">{group.description}</p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-surface-500">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {group.member_count ?? 0} members
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {group.cycle_type === 'monthly'
                      ? `Monthly (Day ${group.cycle_day ?? 1})`
                      : 'Custom cycles'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-surface-400 font-mono truncate max-w-[150px]">
                    UPI: {group.rent_collection_upi}
                  </span>
                  <ArrowRight className="h-4 w-4 text-surface-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
