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

export type AnalyzePropertyResponse = {
  evaluation: EvaluationResult
  evaluationId: string | null
  feedbackModeEnabled: boolean
  credits: number
  trialEvaluationsRemaining: number
  gamification?: GamificationPayload
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

export async function analyzeProperty(
  values: EvaluationFormValues,
  photos: { file: File }[]
): Promise<AnalyzePropertyResponse> {
  const photoPayloads: PhotoPayload[] = await Promise.all(
    photos.slice(0, 5).map(async (photo) => ({
      mimeType: photo.file.type,
      data: await fileToBase64(photo.file),
    }))
  )

  const { data } = await api.post<{
    evaluation: EvaluationResult
    evaluationId: string | null
    feedbackModeEnabled: boolean
    credits?: number
    trialEvaluationsRemaining: number
    gamification?: GamificationPayload
  }>('/evaluation/analyze', {
    ...values,
    photos: photoPayloads.length > 0 ? photoPayloads : undefined,
  })

  const credits = data.credits ?? data.trialEvaluationsRemaining

  return {
    evaluation: {
      ...data.evaluation,
      evaluatedAt: new Date(data.evaluation.evaluatedAt),
      photoPreviews: photos.map((p) => URL.createObjectURL(p.file)),
    },
    evaluationId: data.evaluationId,
    feedbackModeEnabled: data.feedbackModeEnabled,
    credits,
    trialEvaluationsRemaining: credits,
    gamification: data.gamification,
  }
}
