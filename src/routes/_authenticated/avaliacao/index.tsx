import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Avaliacao } from '@/features/avaliacao'

const avaliacaoSearchSchema = z.object({
  job: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/avaliacao/')({
  validateSearch: avaliacaoSearchSchema,
  component: Avaliacao,
})
