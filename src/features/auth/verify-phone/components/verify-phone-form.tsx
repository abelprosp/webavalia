import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { AxiosError } from 'axios'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import {
  resendPhoneCodeRequest,
  verifyPhoneRequest,
} from '@/lib/auth-api'
import { AuthHoneypotField } from '../../components/auth-honeypot-field'

const formSchema = z.object({
  otp: z
    .string()
    .min(6, 'Informe o código de 6 dígitos.')
    .max(6, 'Informe o código de 6 dígitos.'),
})

type VerifyPhoneFormProps = React.HTMLAttributes<HTMLFormElement> & {
  email: string
}

export function VerifyPhoneForm({
  className,
  email,
  ...props
}: VerifyPhoneFormProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: '' },
  })

  const otp = form.watch('otp')

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const result = await verifyPhoneRequest(email, data.otp)
      toast.success(result.message)
      navigate({
        to: '/verify-email',
        search: { email },
        replace: true,
      })
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as { message?: string })?.message
          : undefined
      toast.error(message ?? 'Não foi possível verificar o código.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    setResending(true)
    try {
      const result = await resendPhoneCodeRequest(email)
      toast.success(result.message)
    } catch {
      toast.error('Não foi possível reenviar o SMS.')
    } finally {
      setResending(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        {...props}
      >
        <AuthHoneypotField />

        <FormField
          control={form.control}
          name='otp'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='sr-only'>Código SMS</FormLabel>
              <FormControl>
                <InputOTP
                  maxLength={6}
                  {...field}
                  containerClassName='justify-between sm:[&>[data-slot="input-otp-group"]>div]:w-12'
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button className='mt-2' disabled={otp.length < 6 || isLoading}>
          {isLoading ? (
            <>
              <Loader2 className='size-4 animate-spin' />
              Verificando...
            </>
          ) : (
            'Confirmar telefone'
          )}
        </Button>

        <Button
          type='button'
          variant='outline'
          disabled={resending}
          onClick={handleResend}
        >
          {resending ? (
            <>
              <Loader2 className='size-4 animate-spin' />
              Reenviando...
            </>
          ) : (
            'Reenviar código por SMS'
          )}
        </Button>
      </form>
    </Form>
  )
}
