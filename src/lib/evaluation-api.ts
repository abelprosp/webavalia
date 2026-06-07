import { api } from './api'
import type { GamificationPayload } from './gamification-api'
import type {
  EvaluationFormValues,
  EvaluationResult,
} from '@/features/avaliacao/data/evaluation-engine'

type PhotoPayload = {
  mimeType: string
  data: string
}

export type EvaluationJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'

export type EvaluationJobResult = {
  evaluation: EvaluationResult
  evaluationId: string | null
  feedbackModeEnabled: boolean
  propertyInput?: EvaluationFormValues
  trialEvaluationsRemaining: number
  gamification?: GamificationPayload
}

export type EvaluationJob = {
  id: string
  status: EvaluationJobStatus
  result: EvaluationJobResult | null
  errorMessage: string | null
  trialEvaluationsRemaining: number | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export type EnqueueEvaluationResponse = {
  jobId: string
  status: EvaluationJobStatus
  message: string
  trialEvaluationsRemaining: number
}

export async function submitEvaluationFeedback(input: {
  evaluationId: string
  rating: 'good' | 'bad'
  comment: string
}) {
  const { data } = await api.post<{
    message: string
    reward?: {
      trialEvaluations: number
      trialEvaluationsRemaining: number | null
    }
    gamification?: GamificationPayload
  }>('/evaluation/feedback', input)
  return data
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      if (!base64) {
        reject(new Error('Falha ao converter imagem.'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Falha ao ler imagem.'))
    reader.readAsDataURL(file)
  })
}

export async function enqueueEvaluation(
  values: EvaluationFormValues,
  photos: { file: File }[]
): Promise<EnqueueEvaluationResponse> {
  const photoPayloads: PhotoPayload[] = await Promise.all(
    photos.slice(0, 5).map(async (photo) => ({
      mimeType: photo.file.type,
      data: await fileToBase64(photo.file),
    }))
  )

  const { data } = await api.post<EnqueueEvaluationResponse>('/evaluation/analyze', {
    ...values,
    photos: photoPayloads.length > 0 ? photoPayloads : undefined,
  })

  return data
}

export async function fetchEvaluationJob(jobId: string) {
  const { data } = await api.get<{ job: EvaluationJob }>(
    `/evaluation/jobs/${jobId}`
  )
  return data.job
}

export function normalizeJobResult(
  result: EvaluationJobResult,
  photos: { file: File }[]
): EvaluationJobResult {
  return {
    ...result,
    evaluation: {
      ...result.evaluation,
      evaluatedAt: new Date(result.evaluation.evaluatedAt),
      photoPreviews: photos.map((p) => URL.createObjectURL(p.file)),
    },
  }
}

export async function waitForEvaluationJob(
  jobId: string,
  options?: {
    intervalMs?: number
    onStatus?: (status: EvaluationJobStatus) => void
  }
) {
  const intervalMs = options?.intervalMs ?? 2000

  while (true) {
    const job = await fetchEvaluationJob(jobId)
    options?.onStatus?.(job.status)

    if (job.status === 'completed' && job.result) {
      return job
    }

    if (job.status === 'failed') {
      throw new Error(job.errorMessage ?? 'Erro ao processar avaliação.')
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
