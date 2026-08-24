import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Inbox, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchPipelineBoard,
  moveDealStage,
  type CrmDeal,
  type CrmPipelineBoard,
} from '@/lib/crm-api'
import { Button } from '@/components/ui/button'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { EmptyState } from '@/components/flux/empty-state'
import { DealCard } from './deal-card'
import { DealDetailSheet } from './deal-detail-sheet'

const stageColorClass: Record<string, string> = {
  lime: 'border-flux-lime/40 bg-flux-lime/10',
  lavender: 'border-flux-lavender/30 bg-flux-lavender/10',
  amber: 'border-amber-300/50 bg-amber-50',
  green: 'border-emerald-300/50 bg-emerald-50',
}

export function PipelineBoard() {
  const [board, setBoard] = useState<CrmPipelineBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)

  const loadBoard = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await fetchPipelineBoard()
      setBoard(data)
    } catch {
      setBoard(null)
      setLoadError(true)
      toast.error('Erro ao carregar pipeline.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  async function handleMove(dealId: string, stageId: string) {
    try {
      await moveDealStage(dealId, stageId)
      await loadBoard()
      toast.success('Negócio movido.')
    } catch {
      toast.error('Erro ao mover negócio.')
    } finally {
      setDragOverStageId(null)
    }
  }

  if (loading) {
    return <PageSkeleton rows={4} />
  }

  if (loadError || !board) {
    return (
      <EmptyState
        icon={<Inbox className='size-10' />}
        title='Não foi possível carregar o pipeline'
        description='Verifique sua conexão e tente novamente.'
        actions={
          <Button variant='outline' onClick={() => void loadBoard()}>
            <RefreshCw className='size-4' />
            Tentar novamente
          </Button>
        }
      />
    )
  }

  const stageSummaries = board.stages.map((s) => ({ id: s.id, name: s.name }))
  const totalDeals = board.stages.reduce((acc, s) => acc + s.deals.length, 0)

  return (
    <>
      <div className='mb-4 flex items-center justify-between'>
        <div>
          <h2 className='text-base font-semibold'>{board.pipeline.name}</h2>
          <p className='text-sm text-muted-foreground'>
            Arraste os cards ou use &quot;Mover para&quot; · Lead Scoring por IA
          </p>
        </div>
        <Button variant='outline' size='sm' onClick={() => void loadBoard()}>
          <RefreshCw className='me-2 size-4' />
          Atualizar
        </Button>
      </div>

      {totalDeals === 0 ? (
        <EmptyState
          icon={<Inbox className='size-10' />}
          title='Pipeline vazio'
          description='Avalie imóveis e salve no CRM, ou desbloqueie leads para começar a mover negócios entre etapas.'
          actions={
            <>
              <Button asChild>
                <Link to='/avaliacao'>
                  <Sparkles className='size-4' />
                  Nova avaliação
                </Link>
              </Button>
              <Button variant='outline' asChild>
                <Link to='/leads'>Ver oportunidades</Link>
              </Button>
            </>
          }
        />
      ) : (
        <div className='flex gap-4 overflow-x-auto pb-4'>
          {board.stages.map((stage) => (
            <div
              key={stage.id}
              className={`min-w-[280px] flex-1 rounded-[1.25rem] border p-3 transition ${
                dragOverStageId === stage.id
                  ? 'border-flux-lime bg-flux-lime/10'
                  : (stageColorClass[stage.color] ??
                    'border-black/[0.06] bg-muted/20')
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverStageId(stage.id)
              }}
              onDragLeave={() => setDragOverStageId(null)}
              onDrop={(e) => {
                e.preventDefault()
                const dealId = e.dataTransfer.getData('dealId')
                if (dealId) void handleMove(dealId, stage.id)
              }}
            >
              <div className='mb-3 flex items-center justify-between'>
                <h3 className='text-sm font-semibold'>{stage.name}</h3>
                <span className='rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground'>
                  {stage.deals.length}
                </span>
              </div>

              <div className='space-y-2'>
                {stage.deals.length === 0 ? (
                  <p className='rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground'>
                    Arraste um negócio para cá
                  </p>
                ) : (
                  stage.deals.map((deal: CrmDeal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      currentStageId={stage.id}
                      otherStages={stageSummaries}
                      onClick={() => setSelectedDealId(deal.id)}
                      onMove={handleMove}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <DealDetailSheet
        dealId={selectedDealId}
        stages={board.stages.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          color: s.color,
        }))}
        open={Boolean(selectedDealId)}
        onOpenChange={(open) => {
          if (!open) setSelectedDealId(null)
        }}
        onUpdated={() => void loadBoard()}
      />
    </>
  )
}
