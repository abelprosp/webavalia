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
      'FoxAi indisponível no momento. Tente novamente mais tarde.'
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
    if (response.status === 429) {
      throw new Error(
        'Limite de requisições FoxAi atingido. Aguarde um momento.'
      )
    }
    throw new Error('Erro ao processar mensagem com a FoxAi. Tente novamente.')
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[]
  }

  const content = data.choices[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('A FoxAi não conseguiu gerar uma resposta. Tente novamente.')
  }

  return content
}

export async function* nimChatCompletionStream(
  options: NimChatOptions
): AsyncGenerator<string> {
  if (!config.nvidia.apiKey) {
    throw new Error(
      'FoxAi indisponível no momento. Tente novamente mais tarde.'
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
      max_tokens: options.maxTokens ?? 1500,
      stream: true,
    }),
  })

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        'Limite de requisições FoxAi atingido. Aguarde um momento.'
      )
    }
    throw new Error('Erro ao processar mensagem com a FoxAi. Tente novamente.')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Streaming indisponível.')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const payload = trimmed.slice(6)
      if (payload === '[DONE]') return

      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[]
        }
        const chunk = parsed.choices?.[0]?.delta?.content
        if (chunk) yield chunk
      } catch {
        // ignora linhas malformadas do stream
      }
    }
  }
}
