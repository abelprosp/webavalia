import type { BuildingAge } from './building-age.js'

export const LAND_ONLY_PROPERTY_TYPES = [
  'terreno',
  'lote',
  'terreno-industrial',
  'area-industrial',
] as const

export function isLandOnlyPropertyType(type: string) {
  return (LAND_ONLY_PROPERTY_TYPES as readonly string[]).includes(type)
}

export const MARKET_MAP_EVALUATION_DEFAULTS = {
  bathrooms: 1,
  parking: 1,
  buildingAge: 'mais-10' as BuildingAge,
  conservation: 'bom',
  standardLevel: 'padrao' as const,
  furnishing: 'sem' as const,
  finishLevel: 'padrao' as const,
  condominiumLevel: 'nao-aplica' as const,
  amenities: [] as string[],
}
