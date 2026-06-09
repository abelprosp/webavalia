import { Router } from 'express'

const router = Router()

type ViaCepResponse = {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

router.get('/cep/:cep', async (req, res) => {
  const digits = String(req.params.cep).replace(/\D/g, '')
  if (digits.length !== 8) {
    return res.status(400).json({ message: 'CEP inválido.' })
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!response.ok) {
      return res.status(502).json({ message: 'Falha ao consultar CEP.' })
    }

    const data = (await response.json()) as ViaCepResponse
    if (data.erro || !data.localidade) {
      return res.status(404).json({ message: 'CEP não encontrado.' })
    }

    return res.json({
      cep: data.cep ?? digits,
      street: data.logradouro ?? '',
      neighborhood: data.bairro ?? '',
      city: data.localidade,
      state: data.uf ?? '',
    })
  } catch {
    return res.status(502).json({ message: 'Falha ao consultar CEP.' })
  }
})

export default router
