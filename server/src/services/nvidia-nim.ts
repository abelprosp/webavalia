import { config } from '../config.js'

export type NimMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type NimChatOptions = {
  messages: NimMessage[]
  temperature?: number
  maxTokens?: number
}

export function isNvidiaConfigured() {
  return Boolean(config.nvidia.apiKey)
}

export async function nimChatCompletion(options: NimChatOptions): Promise<string> {
  if (!config.nvidia.apiKey) {
    throw new Error(
      'NVIDIA_API_KEY não configurada. Obtenha uma chave gratuita em build.nvidia.com'
    )
  }

  const response = await fetch(`${config.nvidia.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.nvidia.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.nvidia.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 2048,
      stream: false,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    if (response.status === 429) {
      throw new Error(
        'Limite de requisições NVIDIA atingido (40/min no tier gratuito). Aguarde um momento.'
      )
    }
    throw new Error(`NVIDIA NIM API error: ${response.status} ${text}`)
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[]
  }

  const content = data.choices[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('NVIDIA NIM retornou resposta vazia.')
  }

  return content
}
