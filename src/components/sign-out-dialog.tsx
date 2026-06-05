import { useNavigate, useLocation } from '@tanstack/react-router'
import { getAuthRedirectPath } from '@/lib/redirect-path'
import { useAuthStore } from '@/stores/auth-store'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { auth } = useAuthStore()

  const handleSignOut = () => {
    auth.reset()
    // Preserve current location for redirect after sign-in
    navigate({
      to: '/sign-in',
      search: { redirect: getAuthRedirectPath(location) },
      replace: true,
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Sair'
      desc='Tem certeza que deseja sair? Será necessário entrar novamente para acessar a plataforma.'
      confirmText='Sair'
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
