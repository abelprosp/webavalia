import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  createAdminPlan,
  deleteAdminPlan,
  fetchAdminPlans,
  updateAdminPlan,
  type AdminPlan,
} from '@/lib/admin-api'

const emptyPlan = {
  name: '',
  description: '',
  priceCents: 0,
  leadCredits: 0,
  trialEvaluations: 3,
  isActive: true,
  sortOrder: 0,
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function AdminPlansPage() {
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminPlan | null>(null)
  const [form, setForm] = useState(emptyPlan)
  const [saving, setSaving] = useState(false)

  async function loadPlans() {
    setLoading(true)
    try {
      setPlans(await fetchAdminPlans())
    } catch {
      toast.error('Erro ao carregar planos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlans()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyPlan)
    setDialogOpen(true)
  }

  function openEdit(plan: AdminPlan) {
    setEditing(plan)
    setForm({
      name: plan.name,
      description: plan.description ?? '',
      priceCents: plan.priceCents,
      leadCredits: plan.leadCredits,
      trialEvaluations: plan.trialEvaluations,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        const updated = await updateAdminPlan(editing.id, form)
        setPlans((prev) => prev.map((p) => (p.id === editing.id ? updated : p)))
        toast.success('Plano atualizado.')
      } else {
        const created = await createAdminPlan(form)
        setPlans((prev) => [...prev, created])
        toast.success('Plano criado.')
      }
      setDialogOpen(false)
    } catch {
      toast.error('Erro ao salvar plano.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(plan: AdminPlan) {
    if (!confirm(`Excluir o plano "${plan.name}"?`)) return
    try {
      await deleteAdminPlan(plan.id)
      setPlans((prev) => prev.filter((p) => p.id !== plan.id))
      toast.success('Plano excluído.')
    } catch {
      toast.error('Erro ao excluir plano.')
    }
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <div>
            <CardTitle>Planos</CardTitle>
            <CardDescription>
              Pacotes de créditos e avaliações exibidos na plataforma
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className='size-4' />
            Novo plano
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' />
              Carregando planos...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead>Avaliações</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='text-right'>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className='font-medium'>{plan.name}</div>
                      {plan.description && (
                        <div className='text-xs text-muted-foreground'>
                          {plan.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{formatPrice(plan.priceCents)}</TableCell>
                    <TableCell>{plan.leadCredits}</TableCell>
                    <TableCell>{plan.trialEvaluations}</TableCell>
                    <TableCell>
                      <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                        {plan.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => openEdit(plan)}
                        >
                          Editar
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => handleDelete(plan)}
                        >
                          <Trash2 className='size-4' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar plano' : 'Novo plano'}</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4'>
            <div className='space-y-2'>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className='space-y-2'>
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Preço (centavos)</Label>
                <Input
                  type='number'
                  value={form.priceCents}
                  onChange={(e) =>
                    setForm({ ...form, priceCents: Number(e.target.value) })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label>Créditos de leads</Label>
                <Input
                  type='number'
                  value={form.leadCredits}
                  onChange={(e) =>
                    setForm({ ...form, leadCredits: Number(e.target.value) })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label>Avaliações trial</Label>
                <Input
                  type='number'
                  value={form.trialEvaluations}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      trialEvaluations: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label>Ordem</Label>
                <Input
                  type='number'
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className='flex items-center justify-between rounded-lg border p-3'>
              <Label>Plano ativo</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm({ ...form, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
