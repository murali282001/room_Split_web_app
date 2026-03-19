import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LogIn, Users } from 'lucide-react'
import { useMutateJoinGroup } from '@/api/groups'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'

export default function JoinGroupPage() {
  const { invite_code } = useParams<{ invite_code: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { isAuthenticated } = useAuthStore()
  const joinGroup = useMutateJoinGroup()
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/join/${invite_code}` } })
    }
  }, [isAuthenticated, navigate, invite_code])

  const handleJoin = async () => {
    if (!invite_code) return
    setJoining(true)
    try {
      const group = await joinGroup.mutateAsync(invite_code)
      toast.success('Joined group!', `Welcome to ${group.name}`)
      navigate(`/groups/${group.id}`)
    } catch {
      toast.error('Failed to join', 'Invalid or expired invite code.')
      setJoining(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-surface-100 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white p-8 shadow-lg border border-surface-100 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 mx-auto mb-4">
            <Users className="h-8 w-8 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-surface-900">Join Group</h2>
          <p className="text-sm text-surface-500 mt-2 mb-6">
            You've been invited to join a RoomSplit group.
          </p>
          <div className="rounded-lg bg-surface-50 border border-surface-200 px-4 py-3 mb-6">
            <p className="text-xs text-surface-500 mb-1">Invite Code</p>
            <code className="font-mono text-sm font-semibold text-surface-800">{invite_code}</code>
          </div>
          <Button
            className="w-full"
            size="lg"
            loading={joining || joinGroup.isPending}
            leftIcon={<LogIn className="h-5 w-5" />}
            onClick={handleJoin}
          >
            Join Group
          </Button>
          <button
            className="mt-4 text-sm text-surface-500 hover:text-surface-700"
            onClick={() => navigate('/dashboard')}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
