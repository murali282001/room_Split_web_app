import { useAuthStore } from '@/store/authStore'
import { useMembers, useRoles } from '@/api/groups'

/**
 * Returns true if the current user has the given permission in the specified group.
 * Fetches from members and roles queries — already cached by React Query.
 */
export function usePermission(groupId: string, permission: string): boolean {
  const { user } = useAuthStore()
  const { data: members } = useMembers(groupId)
  const { data: roles } = useRoles(groupId)

  if (!user || !members || !roles) return false

  const myMember = members.find((m) => m.user_id === user.id)
  if (!myMember) return false

  const myRole = roles.find((r) => r.id === myMember.role_id)
  if (!myRole) return false

  return myRole.permissions[permission] === true
}
