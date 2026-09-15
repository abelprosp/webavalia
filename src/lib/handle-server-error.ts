import { AxiosError } from 'axios'
import { toast } from 'sonner'

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(error)
  }

  let errMsg = 'Não foi possível concluir a operação. Tente novamente.'

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = 'Nenhum conteúdo disponível.'
  }

  if (error instanceof AxiosError) {
    if (error.code === 'ERR_CANCELED') return
    const data = error.response?.data
    const message = data?.message ?? data?.title
    if (typeof message === 'string' && message.trim()) {
      errMsg = message
    } else if (!error.response) {
      errMsg =
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
    }
  }

  toast.error(errMsg)
}
