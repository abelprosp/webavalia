import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { searchMarketCities } from '@/lib/market-map-api'
import type { MarketCity } from '../data/cities'

type MarketCitySearchProps = {
  selectedCity: MarketCity
  onCityChange: (city: MarketCity) => void
}

export function MarketCitySearch({
  selectedCity,
  onCityChange,
}: MarketCitySearchProps) {
  const [query, setQuery] = useState(selectedCity.label)
  const [results, setResults] = useState<MarketCity[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(selectedCity.label)
  }, [selectedCity.label])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2 || trimmed === selectedCity.label) {
      setResults([])
      return
    }

    const timeout = window.setTimeout(async () => {
      setLoading(true)
      try {
        const cities = await searchMarketCities(trimmed)
        setResults(cities)
        setOpen(cities.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [query, selectedCity.label])

  function handleSelect(city: MarketCity) {
    setQuery(city.label)
    setOpen(false)
    setResults([])
    onCityChange(city)
  }

  return (
    <div ref={containerRef} className='space-y-2'>
      <Label htmlFor='market-city-search'>Cidade</Label>
      <div className='relative'>
        <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
        <Input
          id='market-city-search'
          value={query}
          placeholder='Busque por cidade (ex.: Curitiba, PR)'
          className='ps-9'
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
        />
        {loading && (
          <Loader2 className='absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground' />
        )}

        {open && results.length > 0 && (
          <ul className='absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-xl border bg-popover p-1 shadow-md'>
            {results.map((city) => (
              <li key={city.label}>
                <button
                  type='button'
                  className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted'
                  onClick={() => handleSelect(city)}
                >
                  <MapPin className='size-3.5 shrink-0 text-flux-lavender' />
                  {city.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className='text-[11px] text-muted-foreground'>
        Mapa centralizado em {selectedCity.city} — {selectedCity.state}
      </p>
    </div>
  )
}
