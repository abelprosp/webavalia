export const BUILDING_AGE_VALUES = [
  'mais-1',
  'mais-5',
  'mais-10',
  'mais-20',
  'mais-30',
] as const

export type BuildingAge = (typeof BUILDING_AGE_VALUES)[number]

export const BUILDING_AGE_LABELS: Record<BuildingAge, string> = {
  'mais-1': 'Mais de 1 ano',
  'mais-5': 'Mais de 5 anos',
  'mais-10': 'Mais de 10 anos',
  'mais-20': 'Mais de 20 anos',
  'mais-30': 'Mais de 30 anos',
}

export function getBuildingAgeLabel(value: string) {
  return BUILDING_AGE_LABELS[value as BuildingAge] ?? value
}
