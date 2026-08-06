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

/** Limiar mínimo de R$/m² para imóveis edificados (residencial/comercial). */
export const BUILT_PROPERTY_MIN_UNIT_PRICE_SQM = 1_500

/** Limiar mínimo de R$/m² para terrenos/lotes (valores tipicamente bem menores). */
export const LAND_PROPERTY_MIN_UNIT_PRICE_SQM = 80

/** Limiar máximo plausível de R$/m² para terrenos urbanos premium. */
export const LAND_PROPERTY_MAX_UNIT_PRICE_SQM = 50_000

export function getMinUnitPriceSqm(propertyType: string) {
  return isLandOnlyPropertyType(propertyType)
    ? LAND_PROPERTY_MIN_UNIT_PRICE_SQM
    : BUILT_PROPERTY_MIN_UNIT_PRICE_SQM
}

/** Metragem usada no cálculo final (área do terreno para lotes; área útil nos demais). */
export function getEvaluationArea(input: { propertyType: string; area: number }) {
  return input.area
}

/** Metragem usada na avaliação quando o filtro está em 0 (qualquer tamanho). */
export const MARKET_MAP_DEFAULT_AREA = 70

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
