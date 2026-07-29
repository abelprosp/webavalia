import { propertyTypeGroups, isLandOnlyPropertyType } from '@/features/avaliacao/data/criteria'
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
import { Input } from '@/components/ui/input'
import type { MarketCity } from '../data/cities'
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

export function MarketMapFilters({
  filters,
  selectedCity,
  onChange,
  onCityChange,
}: MarketMapFiltersProps) {
  const isLand = isLandOnlyPropertyType(filters.propertyType)

  return (
    <div className='space-y-4'>
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
              max={10}
              value={filters.bedrooms}
              onChange={(e) =>
                onChange({
                  ...filters,
                  bedrooms: Math.max(0, Number(e.target.value) || 0),
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
            min={10}
            max={5000}
            value={filters.area}
            onChange={(e) =>
              onChange({
                ...filters,
                area: Math.max(10, Number(e.target.value) || 10),
              })
            }
          />
        </div>
      </div>
    </div>
  )
}
