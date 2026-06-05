export const evaluationCriteria = [
  {
    id: 'location',
    label: 'Localização',
    description: 'Proximidade de serviços, transporte e valorização da região',
    weight: 0.25,
  },
  {
    id: 'infrastructure',
    label: 'Infraestrutura do bairro',
    description: 'Segurança, comércio, escolas e áreas de lazer',
    weight: 0.15,
  },
  {
    id: 'condition',
    label: 'Estado de conservação',
    description: 'Qualidade das instalações, acabamentos e manutenção',
    weight: 0.2,
  },
  {
    id: 'layout',
    label: 'Layout e funcionalidade',
    description: 'Distribuição dos cômodos, iluminação e ventilação',
    weight: 0.15,
  },
  {
    id: 'market',
    label: 'Potencial de mercado',
    description: 'Demanda na região e liquidez do imóvel',
    weight: 0.15,
  },
  {
    id: 'documentation',
    label: 'Documentação',
    description: 'Regularidade jurídica e facilidade de financiamento',
    weight: 0.1,
  },
] as const

export const propertyTypes = [
  { label: 'Apartamento', value: 'apartamento' },
  { label: 'Casa', value: 'casa' },
  { label: 'Cobertura', value: 'cobertura' },
  { label: 'Terreno', value: 'terreno' },
  { label: 'Sala Comercial', value: 'comercial' },
] as const

export const conservationStates = [
  { label: 'Novo / Na planta', value: 'novo' },
  { label: 'Excelente', value: 'excelente' },
  { label: 'Bom', value: 'bom' },
  { label: 'Regular', value: 'regular' },
  { label: 'Precisa reforma', value: 'reforma' },
] as const

export type EvaluationCriteriaId = (typeof evaluationCriteria)[number]['id']
