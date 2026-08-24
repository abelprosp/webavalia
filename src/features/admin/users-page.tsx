import { useEffect, useState } from 'react'
import { Coins, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { getAccountTypeLabel } from '@/lib/account-type'
import {
  adjustUserCredits,
  adjustUserTrialEvaluations,
  fetchAdminUsers,
  updateAdminUser,
  type AdminUser,
} from '@/lib/admin-api'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [accountTypeFilter, setAccountTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [creditAmount, setCreditAmount] = useState('10')
  const [creditDescription, setCreditDescription] = useState('')
  const [trialAmount, setTrialAmount] = useState('3')
  const [saving, setSaving] = useState(false)
  const [confirmCreditsOpen, setConfirmCreditsOpen] = useState(false)

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await fetchAdminUsers({
        search: search || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        accountType:
          accountTypeFilter === 'all' ? undefined : accountTypeFilter,
      })
      setUsers(data)
    } catch {
      toast.error('Erro ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [roleFilter, accountTypeFilter])

  async function handleUpdateRole(user: AdminUser, role: 'admin' | 'corretor') {
    try {
      const updated = await updateAdminUser(user.id, { role })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)))
      toast.success('Papel atualizado.')
    } catch {
      toast.error('Erro ao atualizar papel.')
    }
  }

  async function handleUpdateStatus(
    user: AdminUser,
    status: 'active' | 'suspended'
  ) {
    try {
      const updated = await updateAdminUser(user.id, { status })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)))
      toast.success(
        status === 'active' ? 'Usuário reativado.' : 'Usuário suspenso.'
      )
    } catch {
      toast.error('Erro ao atualizar status.')
    }
  }

  function getSelectedCredits(user: AdminUser) {
    return (
      user.credits ?? user.leadCredits ?? user.trialEvaluationsRemaining ?? 0
    )
  }

  function parseCreditAmount() {
    const amount = Number.parseInt(creditAmount, 10)
    if (!Number.isFinite(amount) || amount === 0) {
      return null
    }
    return amount
  }

  function openCreditsConfirm() {
    const amount = parseCreditAmount()
    if (amount == null) {
      toast.error(
        'Informe uma quantidade válida de créditos (diferente de zero).'
      )
      return
    }
    setConfirmCreditsOpen(true)
  }

  async function handleAdjustCredits() {
    if (!selected) return
    const amount = parseCreditAmount()
    if (amount == null) {
      toast.error(
        'Informe uma quantidade válida de créditos (diferente de zero).'
      )
      return
    }

    setSaving(true)
    try {
      const description =
        creditDescription.trim() ||
        (amount > 0
          ? `Créditos concedidos pelo admin (+${amount})`
          : `Ajuste manual pelo admin (${amount})`)
      const credits = await adjustUserCredits(selected.id, amount, description)
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selected.id
            ? {
                ...u,
                credits,
                leadCredits: credits,
                trialEvaluationsRemaining: credits,
              }
            : u
        )
      )
      setSelected({
        ...selected,
        credits,
        leadCredits: credits,
        trialEvaluationsRemaining: credits,
      })
      setCreditDescription('')
      setConfirmCreditsOpen(false)
      toast.success(
        amount > 0
          ? `${amount} crédito(s) adicionado(s). Novo saldo: ${credits}.`
          : `Créditos ajustados. Novo saldo: ${credits}.`
      )
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Erro ao ajustar créditos.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSetCredits() {
    if (!selected) return
    setSaving(true)
    try {
      const remaining = Number(trialAmount)
      const credits = await adjustUserTrialEvaluations(selected.id, remaining)
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selected.id
            ? {
                ...u,
                credits,
                leadCredits: credits,
                trialEvaluationsRemaining: credits,
              }
            : u
        )
      )
      setSelected({
        ...selected,
        credits,
        leadCredits: credits,
        trialEvaluationsRemaining: credits,
      })
      toast.success('Saldo de créditos definido.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Erro ao definir créditos.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>
            Gerencie contas, papéis, créditos e avaliações trial
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col gap-3 sm:flex-row'>
            <div className='relative flex-1'>
              <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Buscar por nome ou e-mail...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='pl-9'
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className='w-full sm:w-45'>
                <SelectValue placeholder='Filtrar por papel' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos os papéis</SelectItem>
                <SelectItem value='admin'>Admin</SelectItem>
                <SelectItem value='corretor'>Corretor</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={accountTypeFilter}
              onValueChange={setAccountTypeFilter}
            >
              <SelectTrigger className='w-full sm:w-52'>
                <SelectValue placeholder='Tipo de conta' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos os tipos</SelectItem>
                <SelectItem value='pf'>Pessoa física</SelectItem>
                <SelectItem value='pj'>Imobiliária / Corretor</SelectItem>
              </SelectContent>
            </Select>
            <Button variant='outline' onClick={loadUsers}>
              Buscar
            </Button>
          </div>

          {loading ? (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' />
              Carregando usuários...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead className='text-right'>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className='font-medium'>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant='outline'>
                        {getAccountTypeLabel(user.accountType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.role === 'admin' ? 'default' : 'secondary'
                        }
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.status === 'active' ? 'outline' : 'destructive'
                        }
                      >
                        {user.status === 'active' ? 'Ativo' : 'Suspenso'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.credits ??
                        user.leadCredits ??
                        user.trialEvaluationsRemaining}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => {
                          setSelected(user)
                          setCreditAmount('10')
                          setCreditDescription('')
                          setConfirmCreditsOpen(false)
                          setTrialAmount(String(getSelectedCredits(user)))
                        }}
                      >
                        <Coins className='mr-1.5 size-3.5' />
                        Créditos
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmCreditsOpen}
        onOpenChange={setConfirmCreditsOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar concessão de créditos</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className='space-y-2 text-sm text-muted-foreground'>
                {selected &&
                  (() => {
                    const amount = parseCreditAmount() ?? 0
                    const currentBalance = getSelectedCredits(selected)
                    return (
                      <>
                        <p>
                          Conceder{' '}
                          <strong>{amount > 0 ? `+${amount}` : amount}</strong>{' '}
                          crédito(s) para <strong>{selected.name}</strong> (
                          {selected.email}).
                        </p>
                        <p>
                          Saldo atual: {currentBalance} → novo saldo estimado:{' '}
                          {Math.max(currentBalance + amount, 0)}
                        </p>
                        {creditDescription.trim() && (
                          <p>Descrição: {creditDescription.trim()}</p>
                        )}
                      </>
                    )
                  })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault()
                void handleAdjustCredits()
              }}
            >
              {saving ? 'Aplicando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            setConfirmCreditsOpen(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className='space-y-6'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label>Papel</Label>
                  <Select
                    value={selected.role}
                    onValueChange={(value) =>
                      handleUpdateRole(selected, value as 'admin' | 'corretor')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='admin'>Admin</SelectItem>
                      <SelectItem value='corretor'>Corretor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label>Status</Label>
                  <Select
                    value={selected.status ?? 'active'}
                    onValueChange={(value) =>
                      handleUpdateStatus(
                        selected,
                        value as 'active' | 'suspended'
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='active'>Ativo</SelectItem>
                      <SelectItem value='suspended'>Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className='space-y-3 rounded-lg border p-4'>
                <div>
                  <Label>Adicionar créditos</Label>
                  <p className='text-xs text-muted-foreground'>
                    Saldo atual: {getSelectedCredits(selected)} crédito(s). Use
                    valor negativo apenas para remover créditos.
                  </p>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='credit-amount'>Quantidade</Label>
                  <Input
                    id='credit-amount'
                    type='number'
                    min={1}
                    step={1}
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder='Ex.: 10'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='credit-description'>
                    Descrição{' '}
                    <span className='text-muted-foreground'>(opcional)</span>
                  </Label>
                  <Input
                    id='credit-description'
                    value={creditDescription}
                    onChange={(e) => setCreditDescription(e.target.value)}
                    placeholder='Ex.: Bônus de boas-vindas'
                    maxLength={500}
                  />
                </div>
                <Button
                  className='w-full'
                  onClick={openCreditsConfirm}
                  disabled={saving}
                >
                  Conceder créditos
                </Button>
              </div>

              <div className='space-y-2'>
                <Label>Definir saldo absoluto</Label>
                <div className='flex gap-2'>
                  <Input
                    type='number'
                    min={0}
                    value={trialAmount}
                    onChange={(e) => setTrialAmount(e.target.value)}
                  />
                  <Button onClick={handleSetCredits} disabled={saving}>
                    Aplicar
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setSelected(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
