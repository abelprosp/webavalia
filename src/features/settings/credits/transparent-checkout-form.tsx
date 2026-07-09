import { useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  detectCardBrand,
  formatCardNumber,
  formatCep,
  formatExpiry,
  formatPhone,
  generateEfiPaymentToken,
  parseExpiry,
} from '@/lib/efi-card'
import {
  createPlanCheckout,
  type PaymentPricing,
  type PlanCheckoutResponse,
} from '@/lib/payment-api'
import { getApiErrorMessage } from '@/lib/api-error'
import { toast } from 'sonner'

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]

type TransparentCheckoutFormProps = {
  cpfCnpj: string
  pricing: PaymentPricing | null
  onSuccess: (result: PlanCheckoutResponse) => void
}

export function TransparentCheckoutForm({
  cpfCnpj,
  pricing,
  onSuccess,
}: TransparentCheckoutFormProps) {
  const [holderName, setHolderName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [brand, setBrand] = useState('undefined')
  const [phone, setPhone] = useState('')
  const [birth, setBirth] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [zipcode, setZipcode] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [complement, setComplement] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const digits = cardNumber.replace(/\D/g, '')
    if (digits.length < 6) {
      setBrand('undefined')
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      void detectCardBrand(digits).then((detected) => {
        if (!cancelled) setBrand(detected)
      })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [cardNumber])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const documentDigits = cpfCnpj.replace(/\D/g, '')
    if (documentDigits.length !== 11 && documentDigits.length !== 14) {
      toast.error('Informe um CPF ou CNPJ válido antes de pagar.')
      return
    }

    if (!pricing?.efi.payeeCode) {
      toast.error(
        'Checkout de cartão indisponível. Configure EFI_PAYEE_CODE (Identificador de conta na Efí). Pix não precisa desta variável.'
      )
      return
    }

    if (!holderName.trim() || cardNumber.replace(/\D/g, '').length < 13) {
      toast.error('Preencha os dados do cartão corretamente.')
      return
    }

    if (brand === 'undefined' || brand === 'unsupported') {
      toast.error('Bandeira do cartão não identificada ou não suportada.')
      return
    }

    const { month, year } = parseExpiry(expiry)
    if (!month || !year || year.length !== 4) {
      toast.error('Validade inválida. Use MM/AA.')
      return
    }

    if (cvv.replace(/\D/g, '').length < 3) {
      toast.error('CVV inválido.')
      return
    }

    if (phone.replace(/\D/g, '').length < 10) {
      toast.error('Informe um telefone válido com DDD.')
      return
    }

    if (!birth) {
      toast.error('Informe a data de nascimento.')
      return
    }

    if (
      !street.trim() ||
      !number.trim() ||
      !neighborhood.trim() ||
      zipcode.replace(/\D/g, '').length !== 8 ||
      !city.trim() ||
      !state
    ) {
      toast.error('Preencha o endereço de cobrança completo.')
      return
    }

    setLoading(true)
    try {
      const token = await generateEfiPaymentToken({
        payeeCode: pricing.efi.payeeCode,
        environment: pricing.efi.environment,
        brand,
        number: cardNumber,
        cvv,
        expirationMonth: month,
        expirationYear: year,
        holderName,
        holderDocument: documentDigits,
      })

      const result = await createPlanCheckout({
        cpfCnpj: documentDigits,
        paymentToken: token.paymentToken,
        phoneNumber: phone.replace(/\D/g, ''),
        birth,
        billingAddress: {
          street: street.trim(),
          number: number.trim(),
          neighborhood: neighborhood.trim(),
          zipcode: zipcode.replace(/\D/g, ''),
          city: city.trim(),
          state,
          ...(complement.trim() ? { complement: complement.trim() } : {}),
        },
      })

      onSuccess(result)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Erro ao processar pagamento.'))
    } finally {
      setLoading(false)
    }
  }

  const brandLabel =
    brand === 'undefined'
      ? 'Detectando…'
      : brand === 'unsupported'
        ? 'Não suportada'
        : brand.toUpperCase()

  return (
    <form className='space-y-4' onSubmit={handleSubmit}>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-2 sm:col-span-2'>
          <Label htmlFor='holderName'>Nome impresso no cartão</Label>
          <Input
            id='holderName'
            autoComplete='cc-name'
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder='Como está no cartão'
            required
          />
        </div>

        <div className='grid gap-2 sm:col-span-2'>
          <Label htmlFor='cardNumber'>Número do cartão</Label>
          <div className='flex gap-2'>
            <Input
              id='cardNumber'
              inputMode='numeric'
              autoComplete='cc-number'
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder='0000 0000 0000 0000'
              required
            />
            <div className='flex min-w-24 items-center justify-center rounded-md border px-2 text-xs text-muted-foreground'>
              {brandLabel}
            </div>
          </div>
        </div>

        <div className='grid gap-2'>
          <Label htmlFor='expiry'>Validade</Label>
          <Input
            id='expiry'
            inputMode='numeric'
            autoComplete='cc-exp'
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            placeholder='MM/AA'
            required
          />
        </div>

        <div className='grid gap-2'>
          <Label htmlFor='cvv'>CVV</Label>
          <Input
            id='cvv'
            inputMode='numeric'
            autoComplete='cc-csc'
            value={cvv}
            onChange={(e) =>
              setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            placeholder='000'
            required
          />
        </div>

        <div className='grid gap-2'>
          <Label htmlFor='phone'>Telefone com DDD</Label>
          <Input
            id='phone'
            inputMode='tel'
            autoComplete='tel'
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder='(00) 00000-0000'
            required
          />
        </div>

        <div className='grid gap-2'>
          <Label htmlFor='birth'>Data de nascimento</Label>
          <Input
            id='birth'
            type='date'
            value={birth}
            onChange={(e) => setBirth(e.target.value)}
            required
          />
        </div>
      </div>

      <div className='space-y-3 border-t pt-4'>
        <p className='text-sm font-medium'>Endereço de cobrança</p>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='grid gap-2 sm:col-span-2'>
            <Label htmlFor='street'>Rua</Label>
            <Input
              id='street'
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              required
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='number'>Número</Label>
            <Input
              id='number'
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='complement'>Complemento</Label>
            <Input
              id='complement'
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='neighborhood'>Bairro</Label>
            <Input
              id='neighborhood'
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              required
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='zipcode'>CEP</Label>
            <Input
              id='zipcode'
              inputMode='numeric'
              value={zipcode}
              onChange={(e) => setZipcode(formatCep(e.target.value))}
              placeholder='00000-000'
              required
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='city'>Cidade</Label>
            <Input
              id='city'
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='state'>UF</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger id='state' className='w-full'>
                <SelectValue placeholder='Selecione' />
              </SelectTrigger>
              <SelectContent>
                {UF_LIST.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Button type='submit' className='w-full sm:w-auto' disabled={loading}>
        {loading ? (
          <>
            <Loader2 className='size-4 animate-spin' />
            Processando…
          </>
        ) : (
          `Assinar por ${pricing?.evaluationPlan.priceLabel ?? 'R$ 97,00'}/mês`
        )}
      </Button>

      <p className='text-xs text-muted-foreground'>
        Pagamento processado de forma segura pela Efí Bank. Os dados do cartão
        não passam pelo nosso servidor.
      </p>
    </form>
  )
}
