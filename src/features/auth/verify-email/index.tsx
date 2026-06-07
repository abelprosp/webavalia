import { Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  resendVerificationRequest,
  verifyEmailRequest,
} from '@/lib/auth-api'
import { AuthHoneypotField } from '../components/auth-honeypot-field'
import { AuthLeftPanel, AvaliaBrandMark } from '../components/auth-left-panel'

export function VerifyEmailPage() {
  const search = useSearch({ from: '/(auth)/verify-email' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    search.token ? 'loading' : 'idle'
  )
  const [message, setMessage] = useState('')
  const [resendEmail, setResendEmail] = useState(search.email ?? '')
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!search.token) return

    verifyEmailRequest(search.token)
      .then((result) => {
        setStatus('success')
        setMessage(result.message)
      })
      .catch((error: AxiosError<{ message?: string }>) => {
        setStatus('error')
        setMessage(
          error.response?.data?.message ??
            'Não foi possível confirmar seu e-mail.'
        )
      })
  }, [search.token])

  async function handleResend(e: React.FormEvent) {
    e.preventDefault()
    if (!resendEmail.trim()) return

    setResending(true)
    try {
      const result = await resendVerificationRequest(resendEmail.trim())
      toast.success(result.message)
    } catch {
      toast.error('Não foi possível reenviar o e-mail.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className='relative min-h-svh bg-background text-foreground'>
      <div className='relative mx-auto flex min-h-svh max-w-[1440px] items-stretch p-4 md:p-10 lg:p-16'>
        <div className='relative grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-foreground/10 lg:grid-cols-[1fr_minmax(440px,560px)]'>
          <AuthLeftPanel defaultPaletteIndex={2} />
          <div className='relative flex min-h-[680px] flex-col overflow-y-auto bg-card px-6 py-10 lg:py-14'>
            <div className='mx-auto flex w-full max-w-md flex-1 flex-col'>
              <div className='flex items-center justify-center'>
                <AvaliaBrandMark />
              </div>

              <div className='mt-12 space-y-6'>
                {search.token ? (
                  <TokenVerificationStatus status={status} message={message} />
                ) : (
                  <>
                    <div className='space-y-2 text-center'>
                      <div className='mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary'>
                        <Mail className='size-7' />
                      </div>
                      <h1 className='text-2xl font-semibold tracking-tight'>
                        Confirme seu e-mail
                      </h1>
                      <p className='text-sm text-muted-foreground'>
                        Enviamos um link de confirmação
                        {search.email ? (
                          <>
                            {' '}
                            para <strong>{search.email}</strong>
                          </>
                        ) : (
                          ' para o seu e-mail'
                        )}
                        . Abra a mensagem e clique no botão para ativar sua
                        conta.
                      </p>
                    </div>

                    <form onSubmit={handleResend} className='space-y-4'>
                      <AuthHoneypotField />
                      <div className='space-y-2'>
                        <Label htmlFor='resend-email'>Reenviar para</Label>
                        <Input
                          id='resend-email'
                          type='email'
                          required
                          value={resendEmail}
                          onChange={(e) => setResendEmail(e.target.value)}
                          placeholder='seu@email.com'
                        />
                      </div>
                      <Button
                        type='submit'
                        className='w-full'
                        disabled={resending}
                      >
                        {resending ? (
                          <>
                            <Loader2 className='size-4 animate-spin' />
                            Reenviando...
                          </>
                        ) : (
                          'Reenviar e-mail de confirmação'
                        )}
                      </Button>
                    </form>
                  </>
                )}

                <p className='text-center text-sm text-muted-foreground'>
                  <Link to='/sign-in' className='text-foreground hover:underline'>
                    Voltar para o login
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TokenVerificationStatus({
  status,
  message,
}: {
  status: 'idle' | 'loading' | 'success' | 'error'
  message: string
}) {
  if (status === 'loading') {
    return (
      <div className='flex flex-col items-center gap-4 py-8 text-center'>
        <Loader2 className='size-10 animate-spin text-primary' />
        <p className='text-muted-foreground'>Confirmando seu e-mail...</p>
      </div>
    )
  }

  const success = status === 'success'

  return (
    <div className='flex flex-col items-center gap-4 py-8 text-center'>
      {success ? (
        <CheckCircle2 className='size-14 text-primary' />
      ) : (
        <XCircle className='size-14 text-destructive' />
      )}
      <h1 className='text-2xl font-semibold tracking-tight'>
        {success ? 'E-mail confirmado!' : 'Não foi possível confirmar'}
      </h1>
      <p className='text-sm text-muted-foreground'>{message}</p>
      {success ? (
        <Button asChild className='mt-2'>
          <Link to='/sign-in'>Entrar na plataforma</Link>
        </Button>
      ) : (
        <Button asChild variant='outline' className='mt-2'>
          <Link to='/verify-email'>Solicitar novo link</Link>
        </Button>
      )}
    </div>
  )
}
