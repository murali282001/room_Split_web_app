export interface Expense {
  id: string
  title: string
  category?: string
  total_amount_paise: number
  total_amount_rupees: number
  split_type: 'equal' | 'custom'
  expense_date: string
  status: 'draft' | 'active' | 'settled'
  created_at: string
  splits: ExpenseSplit[]
}

export interface ExpenseSplit {
  id: string
  member_id: string
  member_name: string
  owed_amount_rupees: number
  paid_amount_rupees: number
  is_settled: boolean
}
