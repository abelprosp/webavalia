import { useEffect, useState } from 'react'
import { Users, Sparkles, Coins, CreditCard } from 'lucide-react'
import {
  fetchAdminStats,
  fetchAdminTransactions,
  type AdminStats,
  type CreditTransaction,
} from '@/lib/admin-api'
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

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAdminStats(), fetchAdminTransactions(20)])
      .then(([statsData, txData]) => {
        setStats(statsData)
        setTransactions(txData)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className='text-sm text-muted-foreground'>Carregando...</p>
  }

  if (!stats) return null

  const cards = [
    {
      title: 'Usuários',
      value: stats.totalUsers,
      description: `${stats.totalPfUsers} PF · ${stats.totalPjUsers} PJ · ${stats.totalAdmins} admins`,
      icon: Users,
    },
    {
      title: 'Avaliações usadas',
      value: stats.totalEvaluationsUsed,
      description: 'Total de avaliações IA realizadas',
      icon: Sparkles,
    },
    {
      title: 'Créditos em circulação',
      value: stats.totalLeadCredits,
      description: 'Soma de créditos de leads',
      icon: Coins,
    },
    {
      title: 'Planos ativos',
      value: stats.activePlans,
      description: 'Pacotes disponíveis na plataforma',
      icon: CreditCard,
    },
  ]

  return (
    <div className='space-y-6'>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardHeader className='flex flex-row items-center justify-between pb-2'>
                <CardTitle className='text-sm font-medium'>
                  {card.title}
                </CardTitle>
                <Icon className='size-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{card.value}</div>
                <p className='text-xs text-muted-foreground'>
                  {card.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atividade recente</CardTitle>
          <CardDescription>
            Últimos ajustes de créditos e avaliações
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              Nenhuma transação registrada ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <div className='font-medium'>{tx.userName}</div>
                      <div className='text-xs text-muted-foreground'>
                        {tx.userEmail}
                      </div>
                    </TableCell>
                    <TableCell>{tx.type}</TableCell>
                    <TableCell>{tx.amount}</TableCell>
                    <TableCell className='max-w-50 truncate'>
                      {tx.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      {new Date(tx.createdAt).toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
