import amqp, { type Channel } from 'amqplib'
import { config } from '../config.js'

export const EVALUATION_QUEUE = 'avalia.evaluation.jobs'

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>

let connection: AmqpConnection | null = null
let channel: Channel | null = null

export async function getRabbitChannel(): Promise<Channel> {
  if (channel) return channel

  connection = await amqp.connect(config.rabbitmqUrl)
  channel = await connection.createChannel()
  await channel.assertQueue(EVALUATION_QUEUE, { durable: true })

  connection.on('close', () => {
    connection = null
    channel = null
  })

  return channel
}

export async function publishEvaluationJob(jobId: string) {
  const ch = await getRabbitChannel()
  ch.sendToQueue(EVALUATION_QUEUE, Buffer.from(JSON.stringify({ jobId })), {
    persistent: true,
    contentType: 'application/json',
  })
}

export async function closeRabbitConnection() {
  await channel?.close().catch(() => undefined)
  await connection?.close().catch(() => undefined)
  channel = null
  connection = null
}

export async function isRabbitAvailable() {
  try {
    await getRabbitChannel()
    return true
  } catch {
    return false
  }
}
