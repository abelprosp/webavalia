import { createFileRoute } from '@tanstack/react-router'
import { Avaliacao } from '@/features/avaliacao'

export const Route = createFileRoute('/_authenticated/avaliacao/')({
  component: Avaliacao,
})
