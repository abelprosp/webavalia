import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import type { EvaluationSampleQuality } from '../data/evaluation-engine'
import { EvaluationEvidence } from './evaluation-evidence'
import { EvaluationWizardSteps } from './evaluation-wizard-steps'

const quality: EvaluationSampleQuality = {
  status: 'insuficiente',
  receivedCount: 2,
  usedCount: 1,
  excludedCount: 1,
  duplicatesRemoved: 0,
  matchedSourceCount: 1,
  sourceCheckPerformed: true,
  observedValueRange: null,
  warnings: ['Menos de três comparáveis utilizáveis.'],
}
describe('evaluation guidance', () => {
  it('allows return to completed steps and prevents skipping ahead', async () => {
    const onStepChange = vi.fn()
    const screen = await render(
      <EvaluationWizardSteps currentStep={2} onStepChange={onStepChange} />
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Voltar à etapa 1: Imóvel' })
    )
    expect(onStepChange).toHaveBeenCalledWith(1)
    await expect
      .element(screen.getByRole('button', { name: /etapa 3/ }))
      .toBeDisabled()
  })
  it('locks step navigation while evaluating', async () => {
    const screen = await render(
      <EvaluationWizardSteps currentStep={3} onStepChange={vi.fn()} disabled />
    )
    await expect
      .element(screen.getByRole('button', { name: /etapa 1/ }))
      .toBeDisabled()
  })
  it('makes insufficient evidence visible and explains it on demand', async () => {
    const screen = await render(<EvaluationEvidence quality={quality} />)
    await expect.element(screen.getByText('Amostra insuficiente')).toBeVisible()
    await userEvent.click(screen.getByText('Como interpretar esta amostra'))
    await expect
      .element(screen.getByText('Menos de três comparáveis utilizáveis.'))
      .toBeVisible()
    await expect
      .element(screen.getByText('Faixa observada nos comparáveis ajustados'))
      .not.toBeInTheDocument()
  })
  it('does not display sale ranges on rental results', async () => {
    const screen = await render(
      <EvaluationEvidence
        quality={{
          ...quality,
          observedValueRange: { min: 450000, max: 600000 },
        }}
        showRange={false}
      />
    )
    await expect
      .element(screen.getByText('Faixa observada nos comparáveis ajustados'))
      .not.toBeInTheDocument()
  })
})
