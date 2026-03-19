import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { useAuthStore } from '@/store/authStore'
import { TokenResponse, User } from '@/types/auth'

// Request OTP
export function useMutateRequestOtp() {
  return useMutation({
    mutationFn: async (phone: string) => {
      const { data } = await api.post('/auth/otp/request', { phone })
      return data as { message: string }
    },
  })
}

// Verify OTP
export function useMutateVerifyOtp() {
  const { setAuth } = useAuthStore()
  return useMutation({
    mutationFn: async ({ phone, otp }: { phone: string; otp: string }) => {
      const { data } = await api.post<TokenResponse>('/auth/otp/verify', { phone, otp })
      return data
    },
    onSuccess: (data) => {
      setAuth(data.user, data.access_token)
    },
  })
}

// Refresh token
export function useMutateRefreshToken() {
  const { setToken } = useAuthStore()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ access_token: string }>('/auth/token/refresh')
      return data
    },
    onSuccess: (data) => {
      setToken(data.access_token)
    },
  })
}

// Logout
export function useMutateLogout() {
  const { logout } = useAuthStore()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout')
    },
    onSuccess: () => {
      logout()
      queryClient.clear()
    },
  })
}

// Get current user
export function useCurrentUser() {
  const { isAuthenticated } = useAuthStore()
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get<User>('/auth/me')
      return data
    },
    enabled: isAuthenticated,
  })
}

// Update profile
export function useMutateUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name?: string; upi_id?: string }) => {
      const { data } = await api.put<User>('/auth/me', payload)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}
