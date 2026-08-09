import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AxiosError } from 'axios'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerRequest, type AccountType } from '@/lib/auth-api'
import { ACCOUNT_TYPE_OPTIONS } from '@/lib/account-type'
import {
  documentDigits,
  formatDocumentForAccountType,
} from '@/lib/document'
import { validatePassword, TRIAL_EVALUATIONS_TOTAL } from '@/lib/password-policy'
import { useAuthStore } from '@/stores/auth-store'
import { AuthLeftPanel, AvaliaBrandMark } from '../components/auth-left-panel'
import { AuthHoneypotField } from '../components/auth-honeypot-field'
import { cn } from '@/lib/utils'

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
            Escolha o tipo de conta. Você começa com {TRIAL_EVALUATIONS_TOTAL}{' '}
            avaliações grátis com IA e pode ganhar mais 1 bônus ao usar a
            plataforma.
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
  const [accountType, setAccountType] = useState<AccountType>('pf')
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [document, setDocument] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [pending, setPending] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    if (String(formData.get('_honeypot') ?? '').trim()) return

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    const documentValue = documentDigits(document)
    const expectedLength = accountType === 'pf' ? 11 : 14
    if (documentValue.length !== expectedLength) {
      toast.error(
        accountType === 'pf'
          ? 'Informe um CPF válido.'
          : 'Informe um CNPJ válido.'
      )
      return
    }

    if (accountType === 'pj' && !companyName.trim()) {
      toast.error('Informe a razão social da imobiliária.')
      return
    }

    setPending(true)
    try {
      const result = await registerRequest({
        accountType,
        name: name.trim(),
        email: email.trim(),
        password,
        document: documentValue,
        companyName: accountType === 'pj' ? companyName.trim() : undefined,
        tradeName: accountType === 'pj' ? tradeName.trim() || undefined : undefined,
      })

      if (result.needsEmailVerification) {
        toast.success(
          result.message ??
            'Enviamos um link de confirmação para o seu e-mail.'
        )
        navigate({
          to: '/verify-email',
          search: { email: result.email ?? email.trim() },
          replace: true,
        })
        return
      }

      if (result.user) {
        auth.setUser(result.user)
        toast.success(
          `Conta criada! Você tem ${result.user.credits ?? result.user.trialEvaluationsRemaining} créditos para começar.`
        )
        navigate({ to: '/app', replace: true })
      }
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
      <AuthHoneypotField />

      <div className='space-y-2'>
        <Label>Tipo de conta</Label>
        <div className='grid gap-3 sm:grid-cols-2'>
          {ACCOUNT_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type='button'
              role='radio'
              aria-checked={accountType === option.value}
              aria-pressed={accountType === option.value}
              onClick={() => {
                setAccountType(option.value)
                setDocument('')
              }}
              className={cn(
                'rounded-xl border p-4 text-left transition-colors',
                accountType === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <p className='font-medium'>{option.label}</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {accountType === 'pj' && (
        <>
          <div className='space-y-2'>
            <Label htmlFor='signup-company'>
              Razão social <span className='text-muted-foreground'>*</span>
            </Label>
            <Input
              id='signup-company'
              required
              placeholder='Imobiliária Exemplo Ltda'
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='signup-trade'>Nome fantasia</Label>
            <Input
              id='signup-trade'
              placeholder='Opcional'
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
            />
          </div>
        </>
      )}

      <div className='space-y-2'>
        <Label htmlFor='signup-name'>
          {accountType === 'pj' ? 'Nome do responsável' : 'Nome completo'}{' '}
          <span className='text-muted-foreground'>*</span>
        </Label>
        <Input
          id='signup-name'
          required
          placeholder={accountType === 'pj' ? 'Corretor responsável' : 'Seu nome'}
          autoComplete='name'
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='signup-document'>
          {accountType === 'pf' ? 'CPF' : 'CNPJ'}{' '}
          <span className='text-muted-foreground'>*</span>
        </Label>
        <Input
          id='signup-document'
          required
          inputMode='numeric'
          placeholder={accountType === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'}
          value={document}
          onChange={(e) =>
            setDocument(formatDocumentForAccountType(accountType, e.target.value))
          }
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
        <p className='text-xs text-muted-foreground'>
          Mínimo 8 caracteres, com letra maiúscula, minúscula e número.
        </p>
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
