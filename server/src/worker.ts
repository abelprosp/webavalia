import 'dotenv/config'
import { EVALUATION_QUEUE, getRabbitChannel, closeRabbitConnection } from './queue/rabbitmq.js'
import { processEvaluationJob } from './services/evaluation-job-processor.js'
import { pool } from './db/pool.js'

async function startWorker() {
  const channel = await getRabbitChannel()
  const prefetch = Number(process.env.RABBITMQ_PREFETCH ?? 2)
  await channel.prefetch(prefetch)

  console.log(`Worker RabbitMQ ouvindo fila "${EVALUATION_QUEUE}" (prefetch=${prefetch})`)

  await channel.consume(
    EVALUATION_QUEUE,
    async (message) => {
      if (!message) return

      let jobId = ''
      try {
        const payload = JSON.parse(message.content.toString()) as { jobId?: string }
        jobId = payload.jobId ?? ''

        if (!jobId) {
          throw new Error('Mensagem da fila sem jobId.')
        }

        await processEvaluationJob(jobId)
        channel.ack(message)
        console.log(`Job ${jobId} concluído.`)
      } catch (error) {
        console.error(`Erro no job ${jobId || '(desconhecido)'}:`, error)
        channel.nack(message, false, false)
      }
    },
    { noAck: false }
  )
}

startWorker().catch((error) => {
  console.error('Falha ao iniciar worker:', error)
  process.exit(1)
})

async function shutdown() {
  await closeRabbitConnection()
  await pool.end()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
