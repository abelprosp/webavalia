import { Link } from '@tanstack/react-router'
import { Coins, LogOut, Palette, UserCog } from 'lucide-react'
import { CREDITS_AND_PLANS_ENABLED } from '@/lib/feature-flags'
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

type ProfileMenuItemsProps = {
  onSignOut: () => void
  showIcons?: boolean
}

export function ProfileMenuItems({
  onSignOut,
  showIcons = true,
}: ProfileMenuItemsProps) {
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem asChild>
          <Link to='/settings'>
            {showIcons && <UserCog />}
            Perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to='/settings/credits'>
            {showIcons && <Coins />}
            {CREDITS_AND_PLANS_ENABLED
              ? 'Créditos e planos'
              : 'Créditos e planos (Em breve)'}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to='/settings/appearance'>
            {showIcons && <Palette />}
            Aparência
          </Link>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant='destructive' onClick={onSignOut}>
        {showIcons && <LogOut />}
        Sair
      </DropdownMenuItem>
    </>
  )
}
