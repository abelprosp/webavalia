import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/api-error'
import { changePasswordRequest } from '@/lib/auth-api'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z
      .string()
      .min(8, 'Senha deve ter ao menos 8 caracteres.')
      .max(128, 'Senha muito longa.')
      .regex(/[a-z]/, 'Senha deve conter ao menos uma letra minúscula.')
      .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula.')
      .regex(/[0-9]/, 'Senha deve conter ao menos um número.'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'A nova senha deve ser diferente da senha atual.',
    path: ['newPassword'],
  })

type PasswordFormValues = z.infer<typeof passwordFormSchema>

export function PasswordForm() {
  const [saving, setSaving] = useState(false)

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  })

  async function onSubmit(values: PasswordFormValues) {
    setSaving(true)
    try {
      const { message } = await changePasswordRequest(
        values.currentPassword,
        values.newPassword
      )
      form.reset()
      toast.success(message ?? 'Senha alterada com sucesso.')
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'Não foi possível alterar a senha.')
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <FormField
          control={form.control}
          name='currentPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha atual</FormLabel>
              <FormControl>
                <Input
                  type='password'
                  autoComplete='current-password'
                  placeholder='••••••••'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='newPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nova senha</FormLabel>
              <FormControl>
                <Input
                  type='password'
                  autoComplete='new-password'
                  placeholder='••••••••'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Mínimo 8 caracteres, com maiúscula, minúscula e número.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar nova senha</FormLabel>
              <FormControl>
                <Input
                  type='password'
                  autoComplete='new-password'
                  placeholder='••••••••'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit' disabled={saving}>
          {saving ? 'Alterando…' : 'Alterar senha'}
        </Button>
      </form>
    </Form>
  )
}
