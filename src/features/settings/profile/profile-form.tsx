import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  updateProfileRequest,
  type AccountType,
} from '@/lib/auth-api'
import {
  documentDigits,
  formatDocumentForAccountType,
} from '@/lib/document'
import { useAuthStore } from '@/stores/auth-store'
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

function buildProfileSchema(accountType: AccountType) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(2, 'Nome deve ter ao menos 2 caracteres.'),
      email: z.email('E-mail inválido.'),
      document: z.string().trim().min(1, 'Informe o documento.'),
      companyName: z.string().trim().optional(),
      tradeName: z.string().trim().optional(),
    })
    .superRefine((data, ctx) => {
      const digits = documentDigits(data.document)
      const expected = accountType === 'pf' ? 11 : 14
      if (digits.length !== expected) {
        ctx.addIssue({
          code: 'custom',
          path: ['document'],
          message:
            accountType === 'pf'
              ? 'Informe um CPF válido.'
              : 'Informe um CNPJ válido.',
        })
      }

      if (accountType === 'pj' && !data.companyName?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['companyName'],
          message: 'Informe a razão social da imobiliária.',
        })
      }
    })
}

type ProfileFormValues = z.infer<ReturnType<typeof buildProfileSchema>>

export function ProfileForm() {
  const user = useAuthStore((s) => s.auth.user)
  const setUser = useAuthStore((s) => s.auth.setUser)
  const accountType: AccountType = user?.accountType ?? 'pf'
  const isPj = accountType === 'pj'
  const [saving, setSaving] = useState(false)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(buildProfileSchema(accountType)),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      document: user?.document
        ? formatDocumentForAccountType(accountType, user.document)
        : '',
      companyName: user?.companyName ?? '',
      tradeName: user?.tradeName ?? '',
    },
    mode: 'onChange',
  })

  useEffect(() => {
    if (!user) return
    form.reset({
      name: user.name ?? '',
      email: user.email ?? '',
      document: user.document
        ? formatDocumentForAccountType(user.accountType, user.document)
        : '',
      companyName: user.companyName ?? '',
      tradeName: user.tradeName ?? '',
    })
  }, [user, form])

  async function onSubmit(values: ProfileFormValues) {
    setSaving(true)
    try {
      const { user: updated, message } = await updateProfileRequest({
        name: values.name.trim(),
        email: values.email.trim(),
        document: documentDigits(values.document),
        companyName: isPj ? values.companyName?.trim() : undefined,
        tradeName: isPj ? values.tradeName?.trim() || undefined : undefined,
      })
      setUser(updated)
      toast.success(message ?? 'Perfil atualizado com sucesso.')
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'Não foi possível atualizar o perfil.')
      )
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        {isPj && (
          <>
            <FormField
              control={form.control}
              name='companyName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razão social</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Imobiliária Exemplo Ltda'
                      autoComplete='organization'
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='tradeName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome fantasia</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Opcional'
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Como a imobiliária é conhecida no mercado.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {isPj ? 'Nome do responsável' : 'Nome completo'}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={isPj ? 'Corretor responsável' : 'Seu nome'}
                  autoComplete='name'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='document'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{isPj ? 'CNPJ' : 'CPF'}</FormLabel>
              <FormControl>
                <Input
                  inputMode='numeric'
                  placeholder={
                    isPj ? '00.000.000/0000-00' : '000.000.000-00'
                  }
                  {...field}
                  onChange={(e) =>
                    field.onChange(
                      formatDocumentForAccountType(accountType, e.target.value)
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input
                  type='email'
                  placeholder='seu@email.com'
                  autoComplete='email'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Usado para login e notificações da plataforma.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit' disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </form>
    </Form>
  )
}
