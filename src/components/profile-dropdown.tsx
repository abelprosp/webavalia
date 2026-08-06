import { useAuthStore } from '@/stores/auth-store'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { ProfileMenuItems } from '@/components/layout/profile-menu-items'

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const user = useAuthStore((s) => s.auth.user)
  const initials =
    user?.name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() ?? 'AI'

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='relative h-8 w-8 rounded-full'
            aria-label='Menu do perfil'
          >
            <Avatar className='h-8 w-8'>
              <AvatarImage src='/avatars/01.png' alt={user?.name ?? 'Usuário'} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' forceMount>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-sm leading-none font-medium'>
                {user?.name ?? 'Corretor'}
              </p>
              <p className='text-xs leading-none text-muted-foreground'>
                {user?.email ?? ''}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ProfileMenuItems onSignOut={() => setOpen(true)} showIcons={false} />
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
