# Revisão de qualidade e avaliações

Data: 15/09/2026

## Escopo e resultado

Revisão da estrutura React/Express, compilação, testes existentes, fluxo de fotos, mensagens de erro e caminho principal das avaliações: formulário → validação da API → pesquisa Serper → interpretação pela IA → tratamento numérico dos comparáveis → resultado e PDF.

As mudanças corrigem falhas verificáveis. Não representam certificação de precisão imobiliária, auditoria completa de segurança ou homologação de todas as integrações externas.

## Como a avaliação funciona

1. O formulário coleta endereço, tipologia, áreas, quartos, banheiros, vagas, idade, conservação, padrão, acabamento, mobília, condomínio, vista, amenidades e características específicas.
2. O servidor pesquisa anúncios, plano diretor, bairro e valorização em paralelo.
3. A IA interpreta os resultados e propõe comparáveis, notas, fatores e justificativas.
4. O servidor filtra a localização, interpreta preços e áreas declarados e recalcula o preço por m² de cada comparável. Um valor unitário pronto retornado pela IA não substitui essa conta.
5. Cada preço unitário recebe o produto dos fatores. O produto continua limitado entre 0,75 e 1,25 como regra operacional existente, sem atribuir a esse limite uma garantia normativa.
6. Terrenos e imóveis de alto padrão usam mediana. Os demais usam média ponderada; se todos os pesos forem zero, usa-se mediana.
7. O valor de base é a referência unitária multiplicada pela área. Móveis são adicionados somente quando o diferencial correspondente está selecionado. O valor final por m² inclui esse acréscimo.
8. A memória de cálculo é gerada pelo servidor a partir da conta executada. O preço pedido não impõe piso, teto ou aproximação ao resultado e foi retirado dos dados monetários enviados ao avaliador de IA.

## Critérios revisados

| Grupo | Tratamento e observações |
| --- | --- |
| Endereço, bairro e mercado | Pesquisa e filtro de comparáveis por localização; a identificação textual e a veracidade dos anúncios ainda dependem das fontes. |
| Tipo e área | Área do lote para terrenos; área útil/construída para edificações. Corrigida leitura de números com milhar e centavos. |
| Quartos, banheiros e vagas | Validação exige números inteiros não negativos no cliente e no servidor. |
| Conservação e idade | Permanecem atributos de comparação. Instruções de IA reforçadas para evitar contar duas vezes o mesmo efeito. |
| Padrão e acabamento | Comparação deve justificar diferenças e evitar duplicação com conservação e amenidades. |
| Mobília | Valor separado só participa quando móveis de alto padrão estão selecionados; não deve ser duplicado nos fatores. |
| Condomínio e vista | Não presumir vista livre, infraestrutura ou prêmio pela altura. |
| Andar e elevador | Novos campos e tratamento conjunto, conforme seção abaixo. |
| Mezanino e estrutura | Mantidas exigências para lojas e galpões; não foram criados percentuais universais sem evidência. |
| Fotos | Até cinco fotos, 2 MB cada e 5 MB no total no cliente, reservando espaço para codificação no limite de 8 MB da API. Nenhuma foto é descartada silenciosamente no envio. |
| Preço pedido | Apenas referência comercial; removida a calibração que elevava artificialmente o preço calculado. |
| Notas de qualidade | Preservadas as notas calculadas ao normalizar resultados salvos; continuam sendo indicadores produzidos pelo modelo. |
| Aluguel | Interface e PDF identificam a simulação por rendimento sobre o valor de venda. Ainda não é avaliação direta por comparáveis de locação. |
| Precisão e NBR | Removidos grau e tolerância automáticos baseados apenas no número de anúncios. Novos resultados retornam esses campos como nulos. |

## Avaliação por andar

- Térreo é o andar 0.
- Andar da unidade e último andar do prédio são campos distintos.
- O último andar não pode ser inferior ao andar da unidade.
- Elevador até a unidade admite sim, não e não informado. Não marcar a amenidade não é prova de ausência de elevador.
- Apartamentos e derivados, salas comerciais, consultórios e andares corporativos usam esses campos.
- Duplex/triplex não são automaticamente classificados como unidades em edifícios, pois também podem ser casas; é preciso definir essa distinção antes de exigir andar para essas tipologias.
- O fator de andar/acesso só é mantido quando o avaliando e o comparável têm andar e acesso conhecidos. Caso contrário, o servidor aplica fator neutro e registra a justificativa.
- Não há valorização linear fixa por piso. A IA deve considerar escadas, acesso, vista e posição na edificação com evidência local, evitando duplicar o efeito em outros fatores.
- O resultado e o PDF exibem os dados de andar. As fontes ainda precisam ser auditadas para confirmar que os atributos extraídos pela IA são reais.

## Outras melhorias

- Idioma da página corrigido para português brasileiro e metadados do template removidos.
- Upload acessível por Enter e espaço, foco visível e remoção de fotos acessível em telas de toque.
- Respeito à preferência de movimento reduzido.
- Mensagens de erro em português, aproveitando o campo `message` da API e ignorando cancelamentos.
- Respostas JSON para endpoint inexistente, JSON inválido e corpo excedente na API.
- CI atualizado para Node 24 e compilação/testes do servidor.
- Teste incompatível com a API atual do navegador corrigido e diretório compilado do servidor excluído do lint.
- README deixa de sugerir apagar o banco para corrigir credenciais.

## Validação e limites

Resultado da primeira rodada: 132 testes do frontend em Chromium e 9 testes do servidor passaram (141 no total). A compilação de produção do frontend e servidor e a verificação de formatação passaram. A análise estática terminou sem erros, com nove avisos preexistentes. Os testes numéricos cobrem centavos, milhões, preço por m² explícito, independência do preço pedido, pesos zerados, móveis e dados de andar incompletos.

Não foram realizadas transações de pagamento, envios de WhatsApp/email, avaliação paga com IA ou alterações no banco de produção.

Pontos para uma próxima etapa de homologação:

1. Comparar resultados com imóveis de valor conhecido, segmentados por cidade, tipo, andar e elevador; medir erro e viés fora da amostra.
2. Validar automaticamente origem, data, duplicidade e atributos dos anúncios; dados de andar ainda são extraídos pela IA.
3. Substituir limites nacionais fixos de preço por m² por controles calibrados por região. Eles podem excluir imóveis legítimos de mercados baratos ou atípicos.
4. Para uso formal, exigir amostra verificável e revisão profissional. A segunda rodada passou a bloquear o fluxo principal quando não há comparáveis utilizáveis; chamadas legadas sem verificação de fontes ainda podem usar uma referência exploratória.
5. Criar avaliação de aluguel baseada diretamente em anúncios de locação e separar valor imobiliário do valor de bens móveis com critérios de depreciação.
6. Revisar tipologias rurais, imóveis mistos, duplex/triplex e edifícios inteiros com metodologias específicas.
7. Validar fluxos autenticados com banco de teste, isolamento de dados entre contas, pagamentos e provedores externos.
8. Permanecem nove avisos de lint preexistentes e dois pacotes de frontend acima de 500 kB; a compilação passa, mas há trabalho de manutenção e desempenho.

## Referências técnicas consultadas

- [Manual de Avaliação de Imóveis da União, 2024](https://www.gov.br/gestao/pt-br/assuntos/patrimonio-da-uniao/avaliacao-de-imoveis-da-uniao/manual-de-avaliacao-de-imoveis-2024-r3-final-1.pdf/view): tratamento de mercado e precisão dependentes da amostra.
- [Norma para Avaliação de Imóveis Urbanos — IBAPE/SP](https://www.ibape-sp.org.br/adm/upload/uploads/1545075782-NORMA-PARA-AVALIACAO-DE-IMOVEIS-URBANOS-IBAPESP-2011.pdf): fatores e fundamentação por estudo de mercado.

Essas referências orientam a revisão; não validam automaticamente fatores gerados pela IA nem certificam conformidade normativa do produto.


## Segunda rodada: evidência e experiência de uso

- Anúncios com a mesma URL são deduplicados; parâmetros de rastreamento são ignorados, mas identificadores do anúncio são preservados.
- No fluxo principal, apenas comparáveis com link presente nos resultados originais da pesquisa e preço numérico válido entram na conta. Correspondência de URL não prova veracidade do anúncio nem confirma negociação.
- Pesquisa sem nenhum comparável utilizável interrompe a avaliação com mensagem acionável, utilizando o caminho de reversão de créditos já existente na API. Essa reversão não foi homologada com banco real nesta rodada.
- O resultado mostra tamanho da amostra, exclusões, correspondência de fontes, explicação dos ajustes e faixa observada quando há pelo menos três comparáveis. A faixa é o mínimo/máximo ajustado para a área, não um intervalo estatístico de confiança.
- Pesos exibidos refletem a agregação aplicada; resultados por mediana não são apresentados como média ponderada.
- Formulário com resumo atualizado, revisão antes do envio, custo para corretores, retorno às etapas concluídas e validação de todos os campos da etapa.
- Erros permanecem visíveis; erros em etapas ocultas levam o usuário de volta à etapa correta. Campos e navegação ficam bloqueados enquanto a avaliação é processada.
- O foco acompanha etapas e resultado. A revisão é exibida antes do envio também no celular.
- Exportação PDF carregada sob demanda; qualidade da amostra incluída no documento.
- Ação que preserva os dados foi renomeada para “Reavaliar este imóvel”.

Validação desta rodada: testes numéricos e de proveniência, testes de componentes em Chromium, compilação de produção e inspeção visual de desktop (1440 px) e celular (390 px), usando API simulada. O percurso até a revisão não apresentou erros de execução nem rolagem horizontal em celular.

Os pontos de homologação com dados reais e os limites das fontes continuam aplicáveis. A recomendação anterior de não aceitar amostra vazia agora está implementada no fluxo principal.

Verificação final da segunda rodada: 136 testes de frontend + 13 de servidor passaram. Compilação de produção e formatação aprovadas; lint sem erros e com os nove avisos preexistentes.
