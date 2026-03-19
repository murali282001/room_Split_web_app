export type PaymentStatus = 'pending' | 'marked_paid' | 'confirmed' | 'rejected' | 'expired'
export type PaymentType = 'rent' | 'expense' | 'withdrawal'

export interface Payment {
  id: string
  group_id: string
  cycle_id?: string
  payer_id: string
  payer_name: string
  amount_paise: number
  amount_rupees: number
  upi_ref?: string
  payment_type: PaymentType
  status: PaymentStatus
  due_date?: string
  marked_at?: string
  confirmed_at?: string
  rejection_reason?: string
  created_at: string
}

export interface UPILinkResponse {
  upi_link: string
  qr_code_base64: string
  amount_rupees: number
  payee_name: string
  payee_upi: string
}

export interface RentCycle {
  id: string
  group_id: string
  label: string
  period_start: string
  period_end: string
  total_amount_paise: number
  total_amount_rupees: number
  due_date: string
  status: 'draft' | 'active' | 'closed' | 'cancelled'
  created_at: string
}

export interface RentAssignment {
  id: string
  cycle_id: string
  member_id: string
  member_name: string
  assigned_amount_paise: number
  assigned_amount_rupees: number
  split_type: string
}
