import {
  Flame,
  Medal,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { GamificationStats } from '@/lib/gamification-api'
import { cn } from '@/lib/utils'

type GamificationPanelProps = {
  stats: GamificationStats | null
  loading?: boolean
}

function ProgressBar({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className='h-full rounded-full bg-primary transition-all duration-500'
        style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }}
      />
    </div>
  )
}

function AchievementBadge({
  title,
  description,
  rewardEvaluations,
  unlocked,
}: {
  title: string
  description: string
  rewardEvaluations: number
  unlocked: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
        unlocked
          ? 'border-primary/30 bg-primary/5'
          : 'border-dashed border-muted-foreground/20 bg-muted/30 opacity-70'
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          unlocked ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
        )}
      >
        {unlocked ? <Trophy className='size-4' /> : <Medal className='size-4' />}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <p className='text-sm font-medium'>{title}</p>
          {rewardEvaluations > 0 && (
            <Badge variant='secondary' className='text-[10px]'>
              +{rewardEvaluations} avaliação{rewardEvaluations === 1 ? '' : 'ões'}
            </Badge>
          )}
        </div>
        <p className='text-xs text-muted-foreground'>{description}</p>
      </div>
    </div>
  )
}

export function GamificationPanel({ stats, loading }: GamificationPanelProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-48' />
          <Skeleton className='h-4 w-72' />
        </CardHeader>
        <CardContent className='space-y-4'>
          <Skeleton className='h-16 w-full' />
          <Skeleton className='h-24 w-full' />
        </CardContent>
      </Card>
    )
  }

  if (!stats) return null

  const monthlyProgress =
    stats.monthlyGoal.target > 0
      ? stats.monthlyGoal.current / stats.monthlyGoal.target
      : 0

  const unlockedCount = stats.achievements.filter((a) => a.unlocked).length

  return (
    <Card className='border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background'>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Sparkles className='size-5 text-primary' />
              Seu progresso
            </CardTitle>
            <CardDescription>
              Nível, metas e conquistas — cada badge desbloqueada rende avaliações
              bônus
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='secondary' className='gap-1'>
              <Trophy className='size-3.5' />
              {unlockedCount}/{stats.achievements.length} conquistas
            </Badge>
            {stats.streak.current > 0 && (
              <Badge variant='secondary' className='gap-1'>
                <Flame className='size-3.5 text-orange-500' />
                {stats.streak.current} dia{stats.streak.current === 1 ? '' : 's'} seguidos
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2 rounded-lg border bg-background/80 p-4'>
            <div className='flex items-center justify-between gap-2'>
              <div>
                <p className='text-sm font-medium'>
                  Nível {stats.level.level} · {stats.level.name}
                </p>
                <p className='text-xs text-muted-foreground'>
                  {stats.level.evaluationsUsed} avaliações realizadas
                </p>
              </div>
              <Badge>Nv. {stats.level.level}</Badge>
            </div>
            <ProgressBar value={stats.level.progress} />
            <p className='text-xs text-muted-foreground'>
              {stats.level.nextLevelAt != null
                ? `Faltam ${stats.level.evaluationsToNext} avaliações para o próximo nível`
                : 'Você atingiu o nível máximo!'}
            </p>
          </div>

          <div className='space-y-2 rounded-lg border bg-background/80 p-4'>
            <div className='flex items-center justify-between gap-2'>
              <div>
                <p className='flex items-center gap-1.5 text-sm font-medium'>
                  <Target className='size-4 text-primary' />
                  Meta mensal
                </p>
                <p className='text-xs text-muted-foreground'>
                  {stats.monthlyGoal.current}/{stats.monthlyGoal.target} avaliações este mês
                </p>
              </div>
              {stats.monthlyGoal.completed && (
                <Badge className='bg-primary/90'>Concluída</Badge>
              )}
            </div>
            <ProgressBar value={monthlyProgress} />
            <p className='text-xs text-muted-foreground'>
              {stats.monthlyGoal.completed
                ? 'Parabéns — meta do mês batida!'
                : `Mais ${Math.max(stats.monthlyGoal.target - stats.monthlyGoal.current, 0)} para completar`}
            </p>
          </div>
        </div>

        <div>
          <p className='mb-3 text-sm font-medium'>Conquistas</p>
          <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            {stats.achievements.map((achievement) => (
              <AchievementBadge
                key={achievement.key}
                title={achievement.title}
                description={achievement.description}
                rewardEvaluations={achievement.rewardEvaluations}
                unlocked={achievement.unlocked}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
