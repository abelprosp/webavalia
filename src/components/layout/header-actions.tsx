import { CreditsBadge } from '@/components/credits-badge'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { NotificationBell } from '@/features/notifications/components/notification-bell'

type HeaderActionsProps = {
  searchClassName?: string
}

export function HeaderActions({ searchClassName = 'me-auto' }: HeaderActionsProps) {
  return (
    <>
      <Search className={searchClassName} />
      <CreditsBadge />
      <NotificationBell />
      <ThemeSwitch />
      <ConfigDrawer />
      <ProfileDropdown />
    </>
  )
}
