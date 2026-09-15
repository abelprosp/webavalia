import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, label: 'Imóvel' },
  { id: 2, label: 'Detalhes' },
  { id: 3, label: 'Fotos e revisão' },
] as const

type EvaluationWizardStepsProps = {
  currentStep: number
  className?: string
  onStepChange?: (step: number) => void
  disabled?: boolean
}

export function EvaluationWizardSteps({
  currentStep,
  className,
  onStepChange,
  disabled,
}: EvaluationWizardStepsProps) {
  return (
    <nav aria-label='Passos da avaliação' className={cn('mb-6', className)}>
      <ol className='flex items-center gap-2'>
        {STEPS.map((step, index) => {
          const isActive = currentStep === step.id
          const isDone = currentStep > step.id
          return (
            <li key={step.id} className='flex flex-1 items-center gap-2'>
              <button
                type='button'
                disabled={disabled || !isDone || !onStepChange}
                onClick={() => onStepChange?.(step.id)}
                aria-label={`Voltar à etapa ${step.id}: ${step.label}`}
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary',
                  isActive && 'bg-flux-lime text-flux-dark',
                  isDone && 'bg-flux-lime/30 text-flux-dark',
                  !isActive && !isDone && 'bg-muted text-muted-foreground'
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                {step.id}
              </button>
              <span
                className={cn(
                  'text-xs font-medium sm:text-sm',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-px flex-1',
                    isDone ? 'bg-flux-lime/50' : 'bg-border'
                  )}
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export const EVALUATION_WIZARD_STEPS = STEPS
