import { useCallback, useState } from 'react'
import { AxiosError } from 'axios'
import { Filter, Map } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { HeaderActions } from '@/components/layout/header-actions'
import { Main } from '@/components/layout/main'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { queryMarketMapPoint, type MarketMapResult } from '@/lib/market-map-api'
import { isLandOnlyPropertyType } from '@/features/avaliacao/data/criteria'
import { DEFAULT_MARKET_CITY, type MarketCity } from './data/cities'
import {
  MarketMapFilters,
  type MarketMapFiltersState,
} from './components/market-map-filters'
import { MarketMapView } from './components/market-map-view'
import { MarketMapResultPanel } from './components/market-map-result'

const INITIAL_FILTERS: MarketMapFiltersState = {
  propertyType: 'apartamento',
  bedrooms: 2,
  area: 70,
}

export function MapaMercado() {
  const [filters, setFilters] = useState<MarketMapFiltersState>(INITIAL_FILTERS)
  const [selectedCity, setSelectedCity] = useState<MarketCity>(DEFAULT_MARKET_CITY)
  const [clickPosition, setClickPosition] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [result, setResult] = useState<MarketMapResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      setClickPosition({ lat, lng })
      setLoading(true)
      setError(null)
      setResult(null)

      try {
        const isLand = isLandOnlyPropertyType(filters.propertyType)
        const data = await queryMarketMapPoint({
          lat,
          lng,
          city: selectedCity.city,
          state: selectedCity.state,
          propertyType: filters.propertyType,
          ...(isLand ? {} : { bedrooms: filters.bedrooms }),
          area: filters.area,
        })
        setResult(data)
      } catch (err) {
        const message =
          err instanceof AxiosError
            ? (err.response?.data as { message?: string })?.message ??
              'Erro ao consultar preço no mapa.'
            : 'Erro ao consultar preço no mapa.'
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [filters, selectedCity]
  )

  const handleCityChange = useCallback((city: MarketCity) => {
    setSelectedCity(city)
    setClickPosition(null)
    setResult(null)
    setError(null)
  }, [])

  return (
    <>
      <Header fixed>
        <div className='flex items-center gap-2'>
          <Map className='size-5 text-flux-lavender' />
          <h1 className='text-lg font-semibold tracking-tight'>Mapa de Mercado</h1>
        </div>
        <HeaderActions />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 pb-6'>
        <div className='overflow-hidden rounded-[1.75rem] border border-flux-lime/30 bg-gradient-to-br from-flux-lime/15 via-flux-lime/5 to-flux-lavender/10 p-4 md:p-5'>
          <p className='text-sm text-muted-foreground'>
            Clique em qualquer ponto do mapa para consultar o{' '}
            <strong className='text-foreground'>preço por m²</strong> na região,
            usando o mesmo algoritmo de avaliação da plataforma.
          </p>
        </div>

        <div className='flex flex-1 flex-col gap-4 lg:grid lg:grid-cols-[280px_1fr_300px] lg:gap-5'>
          {/* Filtros — desktop */}
          <aside className='hidden lg:block'>
            <div className='sticky top-20 rounded-[1.75rem] border border-black/[0.04] bg-card p-5 shadow-sm'>
              <h2 className='mb-4 text-sm font-semibold'>Filtros</h2>
              <MarketMapFilters
                filters={filters}
                selectedCity={selectedCity}
                onChange={setFilters}
                onCityChange={handleCityChange}
              />
            </div>
          </aside>

          {/* Mapa */}
          <div className='flex min-h-[360px] flex-1 flex-col gap-3 lg:min-h-[520px]'>
            <div className='flex items-center justify-between lg:hidden'>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant='outline' size='sm' className='rounded-full'>
                    <Filter className='me-2 size-4' />
                    Filtros
                  </Button>
                </SheetTrigger>
                <SheetContent side='bottom' className='rounded-t-[1.75rem]'>
                  <SheetHeader>
                    <SheetTitle>Filtros do mapa</SheetTitle>
                  </SheetHeader>
                  <div className='mt-4 pb-6'>
                    <MarketMapFilters
                      filters={filters}
                      selectedCity={selectedCity}
                      onChange={setFilters}
                      onCityChange={handleCityChange}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className='flex-1'>
              <MarketMapView
                city={selectedCity}
                clickPosition={clickPosition}
                onMapClick={handleMapClick}
                loading={loading}
              />
            </div>
          </div>

          {/* Resultado — desktop e mobile abaixo do mapa */}
          <aside className='lg:sticky lg:top-20 lg:self-start'>
            <MarketMapResultPanel result={result} error={error} loading={loading} />
          </aside>
        </div>
      </Main>
    </>
  )
}
