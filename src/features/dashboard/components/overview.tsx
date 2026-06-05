import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import {
  MONTHS,
  useEvaluationsStore,
} from '@/stores/evaluations-store'

export function Overview() {
  const monthlyCounts = useEvaluationsStore((s) => s.monthlyCounts)
  const total = useEvaluationsStore((s) => s.total)

  const data = MONTHS.map((name) => ({
    name,
    total: monthlyCounts[name] ?? 0,
  }))

  if (total === 0) {
    return (
      <div className='flex h-[350px] items-center justify-center text-sm text-muted-foreground'>
        Nenhuma avaliação registrada ainda.
      </div>
    )
  }

  return (
    <ResponsiveContainer width='100%' height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey='name'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          direction='ltr'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Bar
          dataKey='total'
          fill='currentColor'
          radius={[4, 4, 0, 0]}
          className='fill-primary'
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
