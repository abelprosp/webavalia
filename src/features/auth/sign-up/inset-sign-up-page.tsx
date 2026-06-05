import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AxiosError } from 'axios'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerRequest } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth-store'
import { AuthLeftPanel, AvaliaBrandMark } from '../components/auth-left-panel'

function PageBackdrop() {
  return (
    <div
      aria-hidden
      className='pointer-events-none absolute inset-0'
      style={{
        background: [
          'radial-gradient(60% 50% at 10% 10%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 65%)',
          'radial-gradient(50% 50% at 90% 100%, color-mix(in srgb, var(--foreground) 6%, transparent), transparent 65%)',
        ].join(', '),
      }}
    />
  )
}

export function InsetSignUpPage() {
  return (
    <div className='relative min-h-svh bg-background text-foreground'>
      <PageBackdrop />
      <div className='relative mx-auto flex min-h-svh max-w-[1440px] items-stretch p-4 md:p-10 lg:p-16'>
        <div className='relative grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-foreground/10 lg:grid-cols-[1fr_minmax(440px,560px)]'>
          <AuthLeftPanel defaultPaletteIndex={1} />
          <SignUpPanel />
        </div>
      </div>
    </div>
  )
}

function SignUpPanel() {
  return (
    <div className='relative flex min-h-[680px] flex-col overflow-y-auto bg-card text-foreground'>
      <div className='mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10 lg:py-14'>
        <div className='flex items-center justify-center'>
          <AvaliaBrandMark />
        </div>

        <div className='mt-12 flex flex-col gap-1.5'>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Criar conta
          </h1>
          <p className='text-sm text-muted-foreground'>
            Cadastre-se para acessar a plataforma Avalia Imob.
          </p>
        </div>

        <SignUpForm />

        <p className='mt-5 text-sm text-muted-foreground'>
          Já tem conta?{' '}
          <Link to='/sign-in' className='text-foreground hover:underline'>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}

function SignUpForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [pending, setPending] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      return
    }
    if (password.length < 6) {
      toast.error('A senha deve ter ao menos 6 caracteres.')
      return
    }

    setPending(true)
    try {
      const { user, token } = await registerRequest(
        name.trim(),
        email.trim(),
        password
      )
      auth.setUser(user)
      auth.setAccessToken(token)
      toast.success('Conta criada com sucesso!')
      navigate({ to: '/', replace: true })
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as { message?: string })?.message
          : undefined
      toast.error(message ?? 'Erro ao criar conta.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className='mt-8 flex flex-col gap-4'>
      <div className='space-y-2'>
        <Label htmlFor='signup-name'>
          Nome <span className='text-muted-foreground'>*</span>
        </Label>
        <Input
          id='signup-name'
          required
          placeholder='Seu nome'
          autoComplete='name'
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='signup-email'>
          E-mail <span className='text-muted-foreground'>*</span>
        </Label>
        <Input
          id='signup-email'
          type='email'
          required
          placeholder='seu@email.com'
          autoComplete='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='signup-password'>
          Senha <span className='text-muted-foreground'>*</span>
        </Label>
        <div className='relative'>
          <Input
            id='signup-password'
            type={reveal ? 'text' : 'password'}
            required
            placeholder='••••••••'
            autoComplete='new-password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className='pe-10'
          />
          <button
            type='button'
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? 'Ocultar senha' : 'Mostrar senha'}
            className='absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground transition-colors hover:text-foreground'
          >
            {reveal ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
          </button>
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='signup-confirm'>
          Confirmar senha <span className='text-muted-foreground'>*</span>
        </Label>
        <Input
          id='signup-confirm'
          type='password'
          required
          placeholder='••••••••'
          autoComplete='new-password'
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      <Button type='submit' size='lg' disabled={pending} className='mt-2'>
        {pending ? (
          <>
            <Loader2 className='size-4 animate-spin' />
            Criando conta...
          </>
        ) : (
          'Criar conta'
        )}
      </Button>
    </form>
  )
}
