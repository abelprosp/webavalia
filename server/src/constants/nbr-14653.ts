export const NBR_14653_STANDARD = 'ABNT NBR 14653-1 / NBR 14653-2'

export const NBR_14653_PURPOSE =
  'Determinação do valor de mercado do imóvel urbano para fins de referência comercial e tomada de decisão.'

export const NBR_14653_DISCLAIMER =
  'Estimativa automatizada com base em dados de mercado coletados remotamente. Não substitui laudo de avaliação assinado por profissional habilitado (engenheiro, arquiteto ou agrônomo) conforme exigência da NBR 14653 para fins legais, judiciais ou financeiros formais.'

export const NBR_HOMOGENIZATION_FACTORS = [
  { id: 'location', label: 'Localização e inserção urbana' },
  { id: 'area', label: 'Área útil' },
  { id: 'conservation', label: 'Estado de conservação' },
  { id: 'standard', label: 'Padrão construtivo e acabamento' },
  { id: 'age', label: 'Idade do imóvel' },
  { id: 'layout', label: 'Layout e funcionalidade' },
  { id: 'parking', label: 'Vagas de garagem' },
  { id: 'condominium', label: 'Padrão do condomínio' },
  { id: 'view', label: 'Vista e exposição' },
  { id: 'market', label: 'Oferta e demanda local' },
] as const

export const NBR_METHODS = {
  comparativo_direto: {
    id: 'comparativo_direto',
    name: 'Método Comparativo Direto de Dados de Mercado',
    description:
      'Identifica o valor de mercado por tratamento técnico dos atributos dos elementos comparáveis.',
  },
  renda: {
    id: 'renda',
    name: 'Método da Capitalização da Renda',
    description:
      'Estima o valor com base na capitalização da renda líquida prevista do imóvel.',
  },
  evolutivo: {
    id: 'evolutivo',
    name: 'Método Evolutivo',
    description:
      'Soma do valor do terreno com o custo de reprodução da edificação, deduzida a depreciação.',
  },
  custo: {
    id: 'custo',
    name: 'Método da Quantificação de Custo',
    description:
      'Identifica o custo de reprodução ou substituição do bem, com depreciação aplicada.',
  },
} as const

export const NBR_SPECIFICATION_GRADES = {
  I: {
    grade: 'I' as const,
    label: 'Grau de especificação I',
    maxDeviationPercent: 10,
    description:
      'Maior rigor metodológico — amostra ampla e homogeneização detalhada.',
  },
  II: {
    grade: 'II' as const,
    label: 'Grau de especificação II',
    maxDeviationPercent: 15,
    description:
      'Rigor intermediário — amostra adequada com tratamento técnico dos comparáveis.',
  },
  III: {
    grade: 'III' as const,
    label: 'Grau de especificação III',
    maxDeviationPercent: 20,
    description:
      'Estimativa preliminar — amostra limitada ou dados de mercado incompletos.',
  },
}

export function inferSpecificationGrade(comparableCount: number) {
  if (comparableCount >= 6) return NBR_SPECIFICATION_GRADES.II
  if (comparableCount >= 3) return NBR_SPECIFICATION_GRADES.II
  return NBR_SPECIFICATION_GRADES.III
}
