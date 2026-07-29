export const DEFAULT_PIPELINE_STAGES = [
  { name: 'Novo Lead', slug: 'novo_lead', color: 'lime', sortOrder: 0 },
  { name: 'Contato realizado', slug: 'contato_realizado', color: 'lavender', sortOrder: 1 },
  { name: 'Visita agendada', slug: 'visita_agendada', color: 'lavender', sortOrder: 2 },
  { name: 'Visita realizada', slug: 'visita_realizada', color: 'lavender', sortOrder: 3 },
  { name: 'Proposta', slug: 'proposta', color: 'amber', sortOrder: 4 },
  { name: 'Negociação', slug: 'negociacao', color: 'amber', sortOrder: 5 },
  { name: 'Contrato', slug: 'contrato', color: 'green', sortOrder: 6 },
  { name: 'Venda', slug: 'venda', color: 'green', sortOrder: 7 },
] as const

export const DEFAULT_STAGE_TASKS: Record<string, string[]> = {
  novo_lead: ['Ligar para o lead', 'Enviar mensagem de apresentação'],
  contato_realizado: ['Qualificar necessidade', 'Confirmar interesse'],
  visita_agendada: ['Confirmar horário da visita', 'Preparar material do imóvel'],
  visita_realizada: ['Coletar feedback da visita', 'Registrar objeções'],
  proposta: ['Enviar proposta formal', 'Anexar documentação'],
  negociacao: ['Acompanhar contraproposta', 'Alinhar condições comerciais'],
  contrato: ['Revisar minuta', 'Agendar assinatura'],
  venda: ['Registrar venda concluída', 'Solicitar indicações'],
}
