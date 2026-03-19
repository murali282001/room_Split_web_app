export interface AuditLog {
  id: number
  group_id?: string
  actor_name?: string
  actor_phone?: string
  action: string
  entity_type: string
  entity_id: string
  before_state?: Record<string, unknown>
  after_state?: Record<string, unknown>
  created_at: string
}
