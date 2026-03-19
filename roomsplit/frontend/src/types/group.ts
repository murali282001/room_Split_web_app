export type CycleType = 'monthly' | 'custom'
export type MemberStatus = 'active' | 'suspended' | 'left'

export interface Group {
  id: string
  name: string
  description?: string
  rent_collection_upi: string
  cycle_type: CycleType
  cycle_day?: number
  invite_code?: string
  is_active: boolean
  auto_confirm_payments: boolean
  created_by: string
  created_at: string
  member_count?: number
}

export interface Member {
  user_id: string
  user_name: string
  user_phone: string
  user_upi_id?: string
  role_id: string
  role_name: string
  joined_at: string
  status: MemberStatus
}

export interface Role {
  id: string
  group_id: string
  name: string
  is_system: boolean
  permissions: Record<string, boolean>
  created_at: string
}
