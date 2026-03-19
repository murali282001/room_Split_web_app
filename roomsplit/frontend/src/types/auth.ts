export interface User {
  id: string
  phone: string
  name: string
  upi_id?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
  is_new_user: boolean
}
