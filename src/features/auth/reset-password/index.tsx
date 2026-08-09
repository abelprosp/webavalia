import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPasswordRequest } from '@/lib/auth-api'
import { AvaliaBrandMark } from '../components/auth-left-panel'

export function ResetPassword() {
  const navigate = useNavigate()
  const { token } = useSearch({ from: '/(auth)/reset-password' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token) {
      toast.error('Link inválido. Solicite um novo e-mail de redefinição.')
      return
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const result = await resetPasswordRequest(token, password)
      toast.success(result.message)
      void navigate({ to: '/sign-in' })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível redefinir a senha.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='flex min-h-svh items-center justify-center bg-background px-4'>
      <div className='w-full max-w-md space-y-6 rounded-3xl border bg-card p-8 shadow-sm'>
        <div className='flex justify-center'>
          <AvaliaBrandMark />
        </div>
        <div className='space-y-1 text-center'>
          <h1 className='text-2xl font-semibold tracking-tight'>Nova senha</h1>
          <p className='text-sm text-muted-foreground'>
            Defina uma senha forte para acessar sua conta.
          </p>
        </div>

        {!token ? (
          <div className='space-y-4 text-center'>
            <p className='text-sm text-destructive'>
              Token ausente ou inválido. Solicite um novo link.
            </p>
            <Button asChild variant='outline'>
              <Link to='/forgot-password'>Esqueci minha senha</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='password'>Nova senha</Label>
              <Input
                id='password'
                type='password'
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='confirm'>Confirmar senha</Label>
              <Input
                id='confirm'
                type='password'
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type='submit' className='w-full' disabled={loading}>
              {loading ? <Loader2 className='size-4 animate-spin' /> : null}
              Redefinir senha
            </Button>
          </form>
        )}

        <p className='text-center text-sm text-muted-foreground'>
          <Link to='/sign-in' className='underline'>
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  )
}
