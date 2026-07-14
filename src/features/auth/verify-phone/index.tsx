import { Link, useSearch } from '@tanstack/react-router'
import { Smartphone } from 'lucide-react'
import { AuthLeftPanel, AvaliaBrandMark } from '../components/auth-left-panel'
import { VerifyPhoneForm } from './components/verify-phone-form'

export function VerifyPhonePage() {
  const search = useSearch({ from: '/(auth)/verify-phone' })

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
                <div className='space-y-2 text-center'>
                  <div className='mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary'>
                    <Smartphone className='size-7' />
                  </div>
                  <h1 className='text-2xl font-semibold tracking-tight'>
                    Confirme seu telefone
                  </h1>
                  <p className='text-sm text-muted-foreground'>
                    Enviamos um código de 6 dígitos por SMS
                    {search.email ? (
                      <>
                        {' '}
                        para o telefone cadastrado em{' '}
                        <strong>{search.email}</strong>
                      </>
                    ) : (
                      ' para o telefone informado no cadastro'
                    )}
                    .
                  </p>
                </div>

                {search.email ? (
                  <VerifyPhoneForm email={search.email} />
                ) : (
                  <p className='text-center text-sm text-muted-foreground'>
                    E-mail não informado.{' '}
                    <Link to='/sign-up' className='text-foreground hover:underline'>
                      Volte ao cadastro
                    </Link>
                    .
                  </p>
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
