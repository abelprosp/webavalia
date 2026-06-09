export const propertyTypeGroups = [
  {
    label: 'Residencial',
    types: [
      { label: 'Apartamento', value: 'apartamento' },
      { label: 'Casa', value: 'casa' },
      { label: 'Casa em condomínio', value: 'casa-condominio' },
      { label: 'Cobertura', value: 'cobertura' },
      { label: 'Studio', value: 'studio' },
      { label: 'Kitnet', value: 'kitnet' },
      { label: 'Loft', value: 'loft' },
      { label: 'Flat', value: 'flat' },
      { label: 'Duplex', value: 'duplex' },
      { label: 'Triplex', value: 'triplex' },
      { label: 'Sobrado', value: 'sobrado' },
      { label: 'Terreno', value: 'terreno' },
      { label: 'Lote', value: 'lote' },
      { label: 'Chácara', value: 'chacara' },
      { label: 'Sítio', value: 'sitio' },
      { label: 'Fazenda', value: 'fazenda' },
    ],
  },
  {
    label: 'Comercial',
    types: [
      { label: 'Sala comercial', value: 'comercial' },
      { label: 'Loja', value: 'loja' },
      { label: 'Ponto comercial', value: 'ponto-comercial' },
      { label: 'Galpão', value: 'galpao' },
      { label: 'Depósito / Armazém', value: 'deposito' },
      { label: 'Prédio comercial', value: 'predio-comercial' },
      { label: 'Consultório', value: 'consultorio' },
      { label: 'Andar corporativo', value: 'andar-corporativo' },
      { label: 'Hotel', value: 'hotel' },
      { label: 'Pousada', value: 'pousada' },
      { label: 'Restaurante / Bar', value: 'restaurante' },
    ],
  },
  {
    label: 'Industrial',
    types: [
      { label: 'Galpão industrial', value: 'galpao-industrial' },
      { label: 'Terreno industrial', value: 'terreno-industrial' },
      { label: 'Área industrial', value: 'area-industrial' },
    ],
  },
  {
    label: 'Outros',
    types: [
      { label: 'Garagem / Vaga', value: 'garagem' },
      { label: 'Edícula', value: 'edicula' },
      { label: 'Barracão', value: 'barracao' },
      { label: 'Imóvel misto', value: 'misto' },
    ],
  },
] as const

export const propertyTypes = propertyTypeGroups.flatMap((group) =>
  group.types.map((type) => ({ ...type }))
)

export const buildingAgeOptions = [
  { label: 'Mais de 1 ano', value: 'mais-1' },
  { label: 'Mais de 5 anos', value: 'mais-5' },
  { label: 'Mais de 10 anos', value: 'mais-10' },
  { label: 'Mais de 20 anos', value: 'mais-20' },
  { label: 'Mais de 30 anos', value: 'mais-30' },
] as const

export const landOnlyPropertyTypes = [
  'terreno',
  'lote',
  'terreno-industrial',
  'area-industrial',
] as const

export function isLandOnlyPropertyType(type: string) {
  return (landOnlyPropertyTypes as readonly string[]).includes(type)
}

export function showsLotAreaField(type: string) {
  if (type === 'apartamento') return false
  if (isLandOnlyPropertyType(type)) return false
  return true
}

export function getBuildingAgeLabel(value: string) {
  return findLabel(buildingAgeOptions, value)
}

export const conservationStates = [
  { label: 'Novo / Na planta', value: 'novo' },
  { label: 'Excelente', value: 'excelente' },
  { label: 'Bom', value: 'bom' },
  { label: 'Regular', value: 'regular' },
  { label: 'Precisa reforma', value: 'reforma' },
] as const

export const standardLevels = [
  { label: 'Padrão', value: 'padrao' },
  { label: 'Alto padrão', value: 'alto-padrao' },
  { label: 'Luxo', value: 'luxo' },
] as const

export const furnishingOptions = [
  { label: 'Sem mobília', value: 'sem' },
  { label: 'Semi-mobiliado', value: 'semi' },
  { label: 'Totalmente mobiliado', value: 'completo' },
] as const

export const finishLevels = [
  { label: 'Básico', value: 'basico' },
  { label: 'Padrão', value: 'padrao' },
  { label: 'Alto padrão', value: 'alto-padrao' },
  { label: 'Luxo', value: 'luxo' },
] as const

export const condominiumLevels = [
  { label: 'Não se aplica', value: 'nao-aplica' },
  { label: 'Padrão', value: 'padrao' },
  { label: 'Alto padrão', value: 'alto-padrao' },
  { label: 'Clube / resort', value: 'clube' },
] as const

export const viewTypes = [
  { label: 'Sem vista privilegiada', value: 'nenhuma' },
  { label: 'Vista para a cidade', value: 'cidade' },
  { label: 'Vista para o mar', value: 'mar' },
  { label: 'Vista para montanhas', value: 'montanha' },
  { label: 'Vista para parque / área verde', value: 'parque' },
  { label: 'Vista para lago / represa', value: 'lago' },
] as const

export const HIGH_END_FURNITURE_AMENITY = 'moveis-alto-padrao' as const

export const propertyAmenities = [
  { label: 'Ar condicionado', value: 'ar-condicionado' },
  { label: 'Piscina', value: 'piscina' },
  { label: 'Varanda / Terraço', value: 'varanda-terraco' },
  { label: 'Vista privilegiada', value: 'vista-privilegiada' },
  { label: 'Portaria 24h', value: 'portaria-24h' },
  { label: 'Segurança reforçada', value: 'seguranca' },
  { label: 'Academia / fitness', value: 'academia' },
  { label: 'Área de lazer', value: 'area-lazer' },
  { label: 'Automação / casa inteligente', value: 'automacao' },
  { label: 'Elevador', value: 'elevador' },
  { label: 'Suíte master', value: 'suite-master' },
  { label: 'Closet', value: 'closet' },
  { label: 'Cozinha planejada', value: 'cozinha-planejada' },
  { label: 'Churrasqueira', value: 'churrasqueira' },
  { label: 'Jardim privativo', value: 'jardim' },
  { label: 'Garagem coberta', value: 'garagem-coberta' },
  { label: 'Hidromassagem / spa', value: 'hidromassagem' },
  { label: 'Piso de alto padrão', value: 'piso-importado' },
  { label: 'Calefação', value: 'calefacao' },
  { label: 'Placas solares', value: 'placas-solares' },
  { label: 'Móveis alto padrão', value: HIGH_END_FURNITURE_AMENITY },
] as const

function findLabel<T extends readonly { label: string; value: string }[]>(
  options: T,
  value: string
) {
  return options.find((option) => option.value === value)?.label ?? value
}

export function getStandardLevelLabel(value: string) {
  return findLabel(standardLevels, value)
}

export function getFurnishingLabel(value: string) {
  return findLabel(furnishingOptions, value)
}

export function getFinishLevelLabel(value: string) {
  return findLabel(finishLevels, value)
}

export function getCondominiumLevelLabel(value: string) {
  return findLabel(condominiumLevels, value)
}

export function getViewTypeLabel(value: string) {
  return findLabel(viewTypes, value)
}

export function getAmenityLabel(value: string) {
  return findLabel(propertyAmenities, value)
}

export function formatAmenities(amenities: string[] | undefined) {
  if (!amenities?.length) return 'Nenhum informado'
  return amenities.map(getAmenityLabel).join(', ')
}
