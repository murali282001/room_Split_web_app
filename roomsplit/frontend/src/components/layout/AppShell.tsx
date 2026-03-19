import { useState } from 'react'
import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom'
import {
  Home,
  Users,
  Bell,
  LayoutDashboard,
  Calendar,
  CreditCard,
  Receipt,
  Wallet,
  BookOpen,
  BarChart2,
  Shield,
  Settings,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useMutateLogout } from '@/api/auth'
import { useUnreadCount } from '@/api/notifications'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/utils/cn'
import NotificationDrawer from '@/components/notifications/NotificationDrawer'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  permission?: string
}

function NavItemLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.to.split('/').length <= 3}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
        )
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  )
}

function GroupSubNav({ groupId }: { groupId: string }) {
  const canViewAudit = usePermission(groupId, 'audit.view')
  const canViewSettings = usePermission(groupId, 'group.settings')

  const groupNavItems: NavItem[] = [
    {
      label: 'Overview',
      to: `/groups/${groupId}`,
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      label: 'Rent Cycles',
      to: `/groups/${groupId}/rent`,
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      label: 'Payments',
      to: `/groups/${groupId}/payments`,
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      label: 'Expenses',
      to: `/groups/${groupId}/expenses`,
      icon: <Receipt className="h-4 w-4" />,
    },
    {
      label: 'Wallet',
      to: `/groups/${groupId}/wallet`,
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      label: 'Ledger',
      to: `/groups/${groupId}/ledger`,
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      label: 'Analytics',
      to: `/groups/${groupId}/analytics`,
      icon: <BarChart2 className="h-4 w-4" />,
    },
    {
      label: 'Members',
      to: `/groups/${groupId}/members`,
      icon: <Users className="h-4 w-4" />,
    },
    ...(canViewAudit
      ? [
          {
            label: 'Audit Log',
            to: `/groups/${groupId}/audit`,
            icon: <Shield className="h-4 w-4" />,
          },
        ]
      : []),
    ...(canViewSettings
      ? [
          {
            label: 'Settings',
            to: `/groups/${groupId}/settings`,
            icon: <Settings className="h-4 w-4" />,
          },
        ]
      : []),
  ]

  return (
    <div className="mt-2">
      <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-surface-400">
        Group
      </p>
      <nav className="space-y-0.5">
        {groupNavItems.map((item) => (
          <NavItemLink key={item.to} item={item} />
        ))}
      </nav>
    </div>
  )
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { groupId } = useParams<{ groupId?: string }>()
  const { user } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const navigate = useNavigate()

  const logout = useMutateLogout()
  useUnreadCount()

  const mainNavItems: NavItem[] = [
    {
      label: 'Dashboard',
      to: '/dashboard',
      icon: <Home className="h-4 w-4" />,
    },
    {
      label: 'My Groups',
      to: '/groups',
      icon: <Users className="h-4 w-4" />,
    },
  ]

  const handleLogout = async () => {
    await logout.mutateAsync()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-surface-200 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-sm font-bold text-white">RS</span>
          </div>
          <span className="text-lg font-bold text-surface-900">RoomSplit</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <nav className="space-y-0.5">
          {mainNavItems.map((item) => (
            <NavItemLink
              key={item.to}
              item={item}
              onClick={() => setSidebarOpen(false)}
            />
          ))}
        </nav>

        {groupId && <GroupSubNav groupId={groupId} />}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-surface-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transition-transform duration-300 lg:static lg:translate-x-0 lg:shadow-none lg:border-r lg:border-surface-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-surface-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-md text-surface-500 hover:bg-surface-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Logo for mobile */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-600">
                <span className="text-xs font-bold text-white">RS</span>
              </div>
              <span className="font-bold text-surface-900">RoomSplit</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button
              className="relative flex h-9 w-9 items-center justify-center rounded-md text-surface-500 hover:bg-surface-100"
              onClick={() => setNotifOpen(true)}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger-600 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-surface-700 hover:bg-surface-100"
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
                <span className="hidden sm:block max-w-[120px] truncate">{user?.name}</span>
                <ChevronDown className="h-4 w-4 text-surface-400" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-surface-200 bg-white py-1 shadow-lg">
                    <div className="border-b border-surface-100 px-4 py-3">
                      <p className="text-sm font-semibold text-surface-900 truncate">{user?.name}</p>
                      <p className="text-xs text-surface-500 truncate">{user?.phone}</p>
                    </div>
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50"
                      onClick={() => {
                        setUserMenuOpen(false)
                        navigate('/profile-setup')
                      }}
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
                      onClick={() => {
                        setUserMenuOpen(false)
                        void handleLogout()
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Notification drawer */}
      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  )
}
