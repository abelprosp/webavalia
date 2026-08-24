import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  propertyTypeGroups,
  isLandOnlyPropertyType,
} from '@/features/avaliacao/data/criteria'
import type { MarketCity } from '../data/cities'
import { MarketCepSearch } from './market-cep-search'
import { MarketCitySearch } from './market-city-search'

export type MarketMapFiltersState = {
  propertyType: string
  bedrooms: number
  area: number
}

type MarketMapFiltersProps = {
  filters: MarketMapFiltersState
  selectedCity: MarketCity
  onChange: (filters: MarketMapFiltersState) => void
  onCityChange: (city: MarketCity) => void
}

function parseOptionalCount(value: string) {
  if (value.trim() === '') return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.floor(parsed)
}

export function MarketMapFilters({
  filters,
  selectedCity,
  onChange,
  onCityChange,
}: MarketMapFiltersProps) {
  const isLand = isLandOnlyPropertyType(filters.propertyType)

  return (
    <div className='space-y-4'>
      <MarketCepSearch onLocationFound={onCityChange} />

      <div className='relative'>
        <div className='absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-border/60' />
        <p className='relative mx-auto w-fit bg-card px-2 text-[10px] tracking-wider text-muted-foreground uppercase'>
          ou busque por cidade
        </p>
      </div>

      <MarketCitySearch
        selectedCity={selectedCity}
        onCityChange={onCityChange}
      />

      <div className='space-y-2'>
        <Label htmlFor='market-type'>Tipo de imóvel</Label>
        <Select
          value={filters.propertyType}
          onValueChange={(propertyType) =>
            onChange({ ...filters, propertyType })
          }
        >
          <SelectTrigger id='market-type' className='w-full'>
            <SelectValue placeholder='Tipo de imóvel' />
          </SelectTrigger>
          <SelectContent>
            {propertyTypeGroups.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.types.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={isLand ? 'space-y-2' : 'grid grid-cols-2 gap-3'}>
        {!isLand && (
          <div className='space-y-2'>
            <Label htmlFor='market-bedrooms'>Quartos</Label>
            <Input
              id='market-bedrooms'
              type='number'
              min={0}
              placeholder='0 = qualquer'
              value={filters.bedrooms === 0 ? '' : filters.bedrooms}
              onChange={(e) =>
                onChange({
                  ...filters,
                  bedrooms: parseOptionalCount(e.target.value),
                })
              }
            />
          </div>
        )}
        <div className='space-y-2'>
          <Label htmlFor='market-area'>
            {isLand ? 'Área do terreno (m²)' : 'Metragem (m²)'}
          </Label>
          <Input
            id='market-area'
            type='number'
            min={0}
            placeholder='0 = qualquer'
            value={filters.area === 0 ? '' : filters.area}
            onChange={(e) =>
              onChange({
                ...filters,
                area: parseOptionalCount(e.target.value),
              })
            }
          />
        </div>
      </div>

      <p className='text-[11px] text-muted-foreground'>
        Use <strong>0</strong> ou deixe em branco para considerar qualquer
        tamanho na consulta.
      </p>
    </div>
  )
}
