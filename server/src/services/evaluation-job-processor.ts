import { runPropertyEvaluation } from './evaluation-service.js'
import {
  isEvaluationFeedbackModeEnabled,
  savePropertyEvaluation,
} from './evaluation-feedback-service.js'
import {
  mapAchievementForResponse,
  processEvaluationGamification,
} from './gamification-service.js'
import { refundTrialEvaluation } from './trial-service.js'
import {
  getBackgroundJob,
  markJobCompleted,
  markJobFailed,
  markJobProcessing,
} from './job-service.js'
import { createNotification } from './notification-service.js'
import type { EvaluationRequest } from '../types/evaluation.js'

export async function processEvaluationJob(jobId: string) {
  const job = await getBackgroundJob(jobId)
  if (!job) {
    throw new Error(`Job ${jobId} não encontrado.`)
  }

  if (job.status !== 'queued') {
    return job
  }

  await markJobProcessing(jobId)

  const userId = job.userId
  const input = job.payload.input as EvaluationRequest
  const address = typeof input.address === 'string' ? input.address : 'Imóvel'

  try {
    const result = await runPropertyEvaluation(input)
    const feedbackModeEnabled = await isEvaluationFeedbackModeEnabled()

    const evaluationId = await savePropertyEvaluation({
      userId,
      propertyInput: input as Record<string, unknown>,
      evaluationResult: result,
    })

    const gamification = await processEvaluationGamification(userId)

    const responsePayload = {
      evaluation: result,
      evaluationId,
      feedbackModeEnabled,
      propertyInput: input,
      trialEvaluationsRemaining:
        gamification.trialEvaluationsRemaining ??
        job.trialEvaluationsRemaining,
      gamification: {
        level: gamification.level,
        monthlyGoalCompleted: gamification.monthlyGoalCompleted,
        achievementTrialReward: gamification.achievementTrialReward,
        trialEvaluationsRemaining: gamification.trialEvaluationsRemaining,
        newAchievements: gamification.newAchievements.map(mapAchievementForResponse),
      },
    }

    await markJobCompleted(
      jobId,
      responsePayload,
      responsePayload.trialEvaluationsRemaining ?? null
    )

    await createNotification({
      userId,
      type: 'evaluation_ready',
      title: 'Avaliação pronta',
      body: `A análise de "${address}" foi concluída com sucesso.`,
      link: '/avaliacao',
      metadata: { jobId, evaluationId },
    })

    return getBackgroundJob(jobId)
  } catch (error) {
    await refundTrialEvaluation(userId)
    const message =
      error instanceof Error ? error.message : 'Erro ao processar avaliação.'

    await markJobFailed(jobId, message)

    await createNotification({
      userId,
      type: 'evaluation_failed',
      title: 'Falha na avaliação',
      body: `Não foi possível concluir a análise de "${address}". Sua avaliação foi reembolsada.`,
      link: '/avaliacao',
      metadata: { jobId },
    })

    throw error
  }
}
