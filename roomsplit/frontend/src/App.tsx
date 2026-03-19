import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'

// Auth pages
import LoginPage from '@/pages/auth/LoginPage'
import OtpVerifyPage from '@/pages/auth/OtpVerifyPage'
import ProfileSetupPage from '@/pages/auth/ProfileSetupPage'

// Dashboard
import DashboardPage from '@/pages/dashboard/DashboardPage'

// Group pages
import GroupListPage from '@/pages/groups/GroupListPage'
import GroupDetailPage from '@/pages/groups/GroupDetailPage'
import GroupSettingsPage from '@/pages/groups/GroupSettingsPage'
import MembersPage from '@/pages/groups/MembersPage'

// Rent pages
import RentCyclePage from '@/pages/rent/RentCyclePage'
import RentCycleDetailPage from '@/pages/rent/RentCycleDetailPage'

// Payment pages
import PaymentsPage from '@/pages/payments/PaymentsPage'

// Expense pages
import ExpensesPage from '@/pages/expenses/ExpensesPage'

// Wallet page
import WalletPage from '@/pages/wallet/WalletPage'

// Ledger page
import LedgerPage from '@/pages/ledger/LedgerPage'

// Audit page
import AuditLogPage from '@/pages/audit/AuditLogPage'

// Analytics page
import AnalyticsPage from '@/pages/analytics/AnalyticsPage'

// Join page
import JoinGroupPage from '@/pages/groups/JoinGroupPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/otp" element={<OtpVerifyPage />} />
        <Route path="/profile-setup" element={<ProfileSetupPage />} />
        <Route path="/join/:invite_code" element={<JoinGroupPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/groups" element={<GroupListPage />} />
            <Route path="/groups/:groupId" element={<GroupDetailPage />} />
            <Route path="/groups/:groupId/settings" element={<GroupSettingsPage />} />
            <Route path="/groups/:groupId/rent" element={<RentCyclePage />} />
            <Route path="/groups/:groupId/rent/:cycleId" element={<RentCycleDetailPage />} />
            <Route path="/groups/:groupId/payments" element={<PaymentsPage />} />
            <Route path="/groups/:groupId/wallet" element={<WalletPage />} />
            <Route path="/groups/:groupId/ledger" element={<LedgerPage />} />
            <Route path="/groups/:groupId/expenses" element={<ExpensesPage />} />
            <Route path="/groups/:groupId/audit" element={<AuditLogPage />} />
            <Route path="/groups/:groupId/analytics" element={<AnalyticsPage />} />
            <Route path="/groups/:groupId/members" element={<MembersPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster position="top-right" richColors closeButton />
    </BrowserRouter>
  )
}
