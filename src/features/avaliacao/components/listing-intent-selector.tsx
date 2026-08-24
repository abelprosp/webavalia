import { KeyRound, Sparkles, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  LISTING_INTENT_OPTIONS,
  type EvaluationFormValues,
  type ListingIntent,
} from '../data/evaluation-engine'
import type { Control } from 'react-hook-form'

const INTENT_ICONS: Record<ListingIntent, typeof KeyRound> = {
  alugar: KeyRound,
  vender: Tag,
}

type ListingIntentSelectorProps = {
  control: Control<EvaluationFormValues>
}

export function ListingIntentSelector({ control }: ListingIntentSelectorProps) {
  return (
    <div className='overflow-hidden rounded-[1.75rem] border-2 border-flux-lime/40 bg-gradient-to-br from-flux-lime/20 via-flux-lime/10 to-flux-lavender/10 p-1 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]'>
      <div className='rounded-[1.5rem] bg-card/95 p-5 sm:p-6'>
        <div className='mb-5 flex items-start gap-3'>
          <div className='flex size-11 shrink-0 items-center justify-center rounded-2xl bg-flux-lime/30 text-flux-dark'>
            <Sparkles className='size-5' />
          </div>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-flux-dark/70'>
              Disponibilizar para
            </p>
            <h3 className='mt-1 text-xl font-bold tracking-tight sm:text-[1.35rem]'>
              O que você deseja fazer?
            </h3>
            <p className='mt-1 text-sm text-muted-foreground'>
              Escolha abaixo para ver a estimativa de aluguel ou de venda.
            </p>
          </div>
        </div>

        <FormField
          control={control}
          name='listingIntent'
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4'
                >
                  {LISTING_INTENT_OPTIONS.map((option) => {
                    const Icon = INTENT_ICONS[option.value]
                    const isSelected = field.value === option.value

                    return (
                      <FormItem key={option.value} className='space-y-0'>
                        <FormControl>
                          <RadioGroupItem
                            value={option.value}
                            id={`listing-intent-${option.value}`}
                            className='sr-only'
                          />
                        </FormControl>
                        <label
                          htmlFor={`listing-intent-${option.value}`}
                          className={cn(
                            'group flex cursor-pointer flex-col gap-4 rounded-[1.25rem] border-2 p-4 transition-all duration-200 sm:p-5',
                            'hover:-translate-y-0.5 hover:shadow-md',
                            isSelected
                              ? 'border-flux-lime bg-flux-lime/15 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_12px_28px_-12px_rgba(0,0,0,0.25)] ring-2 ring-flux-lime/30'
                              : 'border-black/[0.08] bg-muted/20 hover:border-flux-lavender/40 hover:bg-muted/35'
                          )}
                        >
                          <div className='flex items-start justify-between gap-3'>
                            <div
                              className={cn(
                                'flex size-12 shrink-0 items-center justify-center rounded-2xl transition-colors',
                                isSelected
                                  ? 'bg-flux-lime text-flux-dark'
                                  : 'bg-muted text-muted-foreground group-hover:bg-flux-lavender/25 group-hover:text-flux-dark'
                              )}
                            >
                              <Icon className='size-6' strokeWidth={2.25} />
                            </div>
                            <span
                              className={cn(
                                'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                                isSelected
                                  ? 'bg-flux-dark text-white'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {isSelected ? 'Selecionado' : 'Opção'}
                            </span>
                          </div>

                          <div>
                            <p
                              className={cn(
                                'text-lg font-bold tracking-tight',
                                isSelected ? 'text-flux-dark' : 'text-foreground'
                              )}
                            >
                              {option.label}
                            </p>
                            <p className='mt-1 text-sm leading-snug text-muted-foreground'>
                              {option.description}
                            </p>
                          </div>
                        </label>
                      </FormItem>
                    )
                  })}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}
