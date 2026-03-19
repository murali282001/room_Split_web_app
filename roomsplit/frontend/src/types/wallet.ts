export interface Wallet {
  group_id: string
  balance_paise: number
  balance_rupees: number
  last_updated_at: string
}

export interface WalletTransaction {
  id: string
  transaction_type: 'credit' | 'debit'
  amount_paise: number
  amount_rupees: number
  balance_after_rupees: number
  description?: string
  created_at: string
}

export interface Withdrawal {
  id: string
  amount_paise: number
  amount_rupees: number
  destination_upi: string
  reason?: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  requested_by_name: string
  approved_at?: string
  completed_at?: string
  upi_ref?: string
  created_at: string
}
