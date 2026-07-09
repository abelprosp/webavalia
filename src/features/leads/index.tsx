import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Eye,
  Inbox,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
} from 'lucide-react'
import { toast } from 'sonner'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HeaderActions } from '@/components/layout/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { formatCurrency } from '@/features/avaliacao/data/evaluation-engine'
import {
  fetchLeads,
  updateLeadStatus,
  type LeadItem,
} from '@/lib/leads-api'
import { syncCreditsFromUser } from '@/stores/credits-store'
import { UnlockLeadDialog } from './components/unlock-lead-dialog'
import { LeadDetailDialog } from './components/lead-detail-dialog'

function statusVariant(
  status: LeadItem['status']
): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'contatado':
      return 'default'
    case 'desbloqueado':
      return 'secondary'
    default:
      return 'outline'
  }
}

function statusLabel(status: LeadItem['status']) {
  switch (status) {
    case 'contatado':
      return 'Contatado'
    case 'desbloqueado':
      return 'Desbloqueado'
    default:
      return 'Novo'
  }
}

export function Leads() {
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unlockLead, setUnlockLead] = useState<LeadItem | null>(null)
  const [detailLead, setDetailLead] = useState<LeadItem | null>(null)

  const loadLeads = useCallback(async () => {
    try {
      const data = await fetchLeads()
      setLeads(data)
    } catch {
      toast.error('Erro ao carregar leads.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLeads()
  }, [loadLeads])

  const stats = useMemo(() => {
    return {
      total: leads.length,
      novos: leads.filter((l) => !l.unlocked).length,
      desbloqueados: leads.filter((l) => l.unlocked).length,
      comAvaliacao: leads.filter((l) => l.hasEvaluation).length,
    }
  }, [leads])

  function handleUnlockSuccess(lead: LeadItem, credits: number) {
    syncCreditsFromUser(credits)
    setLeads((current) =>
      current.map((item) => (item.id === lead.id ? lead : item))
    )
    setUnlockLead(null)
    setDetailLead(lead)
    toast.success('Lead desbloqueado!')
  }

  async function markContacted(lead: LeadItem) {
    try {
      const updated = await updateLeadStatus(lead.id, 'contatado')
      setLeads((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      )
      toast.success('Lead marcado como contatado.')
    } catch {
      toast.error('Erro ao atualizar status.')
    }
  }

  return (
    <>
      <Header fixed>
        <HeaderActions />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>Leads</h2>
          <p className='text-muted-foreground'>
            Avaliações e contatos captados pelo WhatsApp da Avalia.
          </p>
        </div>

        <div className='grid gap-4 sm:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Novos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.novos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Desbloqueados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.desbloqueados}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Com avaliação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.comAvaliacao}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <MessageCircle className='size-5' />
              Leads do WhatsApp
            </CardTitle>
            <CardDescription>
              Desbloqueie com créditos para ver telefone e detalhes completos da
              avaliação.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className='flex items-center justify-center gap-2 py-12 text-muted-foreground'>
                <Loader2 className='size-5 animate-spin' />
                Carregando leads...
              </div>
            ) : leads.length === 0 ? (
              <div className='flex flex-col items-center gap-3 py-12 text-center'>
                <Inbox className='size-8 text-muted-foreground' />
                <p className='text-sm text-muted-foreground'>
                  Nenhum lead do WhatsApp ainda. Configure o webhook para começar
                  a receber avaliações.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Interesse</TableHead>
                    <TableHead>Valor est.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='text-right'>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className='font-medium'>{lead.name}</div>
                        <div className='text-xs text-muted-foreground'>
                          {new Date(lead.receivedAt).toLocaleString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1 text-sm'>
                          <MapPin className='size-3.5 text-muted-foreground' />
                          <span className='line-clamp-1'>{lead.location}</span>
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          {lead.propertyType}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline'>{lead.interest}</Badge>
                      </TableCell>
                      <TableCell>
                        {lead.estimatedValue != null
                          ? formatCurrency(lead.estimatedValue)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(lead.status)}>
                          {statusLabel(lead.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-1'>
                          {lead.unlocked ? (
                            <>
                              <Button
                                variant='ghost'
                                size='icon'
                                onClick={() => setDetailLead(lead)}
                              >
                                <Eye className='size-4' />
                              </Button>
                              {lead.status !== 'contatado' && (
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  onClick={() => void markContacted(lead)}
                                >
                                  <Phone className='size-4' />
                                  Contatado
                                </Button>
                              )}
                            </>
                          ) : (
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => setUnlockLead(lead)}
                            >
                              <Lock className='size-4' />
                              Desbloquear
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Main>

      <UnlockLeadDialog
        lead={unlockLead}
        open={Boolean(unlockLead)}
        onOpenChange={(open) => !open && setUnlockLead(null)}
        onSuccess={handleUnlockSuccess}
      />

      <LeadDetailDialog
        lead={detailLead}
        open={Boolean(detailLead)}
        onOpenChange={(open) => !open && setDetailLead(null)}
      />
    </>
  )
}
