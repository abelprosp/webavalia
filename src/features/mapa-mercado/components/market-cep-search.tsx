import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCepInput } from '@/lib/address-api'
import { lookupMarketMapCep } from '@/lib/market-map-api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MarketCity } from '../data/cities'

type MarketCepSearchProps = {
  onLocationFound: (location: MarketCity) => void
}

export function MarketCepSearch({ onLocationFound }: MarketCepSearchProps) {
  const [cep, setCep] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLookup(rawCep: string) {
    const digits = rawCep.replace(/\D/g, '')
    if (digits.length !== 8) return

    setLoading(true)
    try {
      const location = await lookupMarketMapCep(digits)
      onLocationFound(location)
      toast.success(`Mapa centralizado em ${location.label}`)
    } catch {
      toast.error('CEP não encontrado ou não foi possível localizar no mapa.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='space-y-2'>
      <Label htmlFor='market-cep'>CEP</Label>
      <div className='relative'>
        <Input
          id='market-cep'
          inputMode='numeric'
          maxLength={9}
          placeholder='00000-000'
          value={cep}
          onChange={(e) => {
            const formatted = formatCepInput(e.target.value)
            setCep(formatted)
            if (formatted.replace(/\D/g, '').length === 8) {
              void handleLookup(formatted)
            }
          }}
          onBlur={() => {
            if (cep.replace(/\D/g, '').length === 8) {
              void handleLookup(cep)
            }
          }}
        />
        {loading && (
          <Loader2 className='absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground' />
        )}
      </div>
      <p className='text-[11px] text-muted-foreground'>
        Informe o CEP para centralizar o mapa na região
      </p>
    </div>
  )
}
