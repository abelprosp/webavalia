import { useEffect, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Sparkles, Home, Loader2, Camera, Gem, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import {
  emitMyEvaluationsUpdated,
  useCreditsStore,
} from '@/stores/credits-store'
import { useEvaluationDraftStore } from '@/stores/evaluation-draft-store'
import { useEvaluationsStore } from '@/stores/evaluations-store'
import {
  composeAddressFromCep,
  formatCepInput,
  lookupCep,
  type CepLookupResult,
} from '@/lib/address-api'
import { isBrokerAccount } from '@/lib/auth-api'
import { analyzeProperty } from '@/lib/evaluation-api'
import { CREDITS_AND_PLANS_ENABLED } from '@/lib/feature-flags'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Header } from '@/components/layout/header'
import { HeaderActions } from '@/components/layout/header-actions'
import { Main } from '@/components/layout/main'
import { showGamificationUpdates } from '@/features/gamification/lib/show-gamification-toasts'
import { EvaluationDraftBanner } from './components/evaluation-draft-banner'
import { EvaluationFeedbackPanel } from './components/evaluation-feedback'
import { EvaluationResultPanel } from './components/evaluation-result'
import { EvaluationReview } from './components/evaluation-review'
import { EvaluationWizardSteps } from './components/evaluation-wizard-steps'
import { FloodExperienceFeedback } from './components/flood-experience-feedback'
import { ListingIntentSelector } from './components/listing-intent-selector'
import { PhotoUpload, type EvaluationPhoto } from './components/photo-upload'
import { PublishPropertyLead } from './components/publish-property-lead'
import {
  buildingAgeOptions,
  condominiumLevels,
  conservationStates,
  finishLevels,
  furnishingOptions,
  hasFloorInformation,
  isLandOnlyPropertyType,
  isPavilionPropertyType,
  isStoreLikePropertyType,
  HIGH_END_FURNITURE_AMENITY,
  propertyAmenities,
  propertyTypeGroups,
  showsLotAreaField,
  standardLevels,
  structureTypeOptions,
  viewTypes,
} from './data/criteria'
import {
  DEFAULT_EVALUATION_FORM_VALUES,
  evaluationFormSchema,
  type EvaluationFormValues,
  type EvaluationResult,
} from './data/evaluation-engine'
import { isDraftWorthy } from './lib/evaluation-draft'

export function Avaliacao() {
  const navigate = useNavigate()
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [evaluatedProperty, setEvaluatedProperty] =
    useState<EvaluationFormValues | null>(null)
  const [evaluationId, setEvaluationId] = useState<string | null>(null)
  const [feedbackModeEnabled, setFeedbackModeEnabled] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [floodFeedbackSubmitted, setFloodFeedbackSubmitted] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluatingStep, setEvaluatingStep] = useState('')
  const [photos, setPhotos] = useState<EvaluationPhoto[]>([])
  const recordEvaluation = useEvaluationsStore((s) => s.recordEvaluation)
  const credits = useCreditsStore((s) => s.credits)
  const updateCredits = useAuthStore((s) => s.auth.updateCredits)
  const authUser = useAuthStore((s) => s.auth.user)
  const userId = authUser?.id
  const isBroker = isBrokerAccount(authUser)
  const saveDraft = useEvaluationDraftStore((s) => s.saveDraft)
  const getDraftForUser = useEvaluationDraftStore((s) => s.getDraftForUser)
  const clearDraft = useEvaluationDraftStore((s) => s.clearDraft)
  const resultRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (result) {
      resultRef.current?.focus()
      resultRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [result])
  const photosRef = useRef(photos)
  photosRef.current = photos
  const draftRestoredRef = useRef(false)
  const [cepLookup, setCepLookup] = useState<CepLookupResult | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
  }, [])

  const form = useForm<EvaluationFormValues>({
    resolver: zodResolver(evaluationFormSchema),
    defaultValues: DEFAULT_EVALUATION_FORM_VALUES,
  })

  useEffect(() => {
    if (!userId || draftRestoredRef.current) return

    const draft = getDraftForUser(userId)
    if (draft && isDraftWorthy(draft.values)) {
      form.reset(draft.values)
      setShowDraftBanner(true)
      setDraftUpdatedAt(draft.updatedAt)
      draftRestoredRef.current = true
    }
  }, [userId, form, getDraftForUser])

  useEffect(() => {
    if (!userId) return

    let timeout: ReturnType<typeof setTimeout>

    const persistDraft = (values: EvaluationFormValues) => {
      if (isDraftWorthy(values)) {
        saveDraft(userId, values)
        setDraftUpdatedAt(new Date().toISOString())
        setShowDraftBanner(true)
        return
      }

      clearDraft(userId)
      setShowDraftBanner(false)
      setDraftUpdatedAt(null)
    }

    const subscription = form.watch((values) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        persistDraft(values as EvaluationFormValues)
      }, 600)
    })

    const flushDraft = () => {
      persistDraft(form.getValues())
    }

    window.addEventListener('pagehide', flushDraft)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
      window.removeEventListener('pagehide', flushDraft)
      flushDraft()
    }
  }, [userId, form, saveDraft, clearDraft])

  function handleDiscardDraft() {
    if (userId) clearDraft(userId)
    form.reset(DEFAULT_EVALUATION_FORM_VALUES)
    setCepLookup(null)
    setShowDraftBanner(false)
    setDraftUpdatedAt(null)
    toast.success('Rascunho descartado.')
  }

  const propertyType = form.watch('propertyType')
  const selectedAmenities = form.watch('amenities')
  const hasHighEndFurniture = selectedAmenities?.includes(
    HIGH_END_FURNITURE_AMENITY
  )
  const showLotArea = showsLotAreaField(propertyType)
  const isLandOnly = isLandOnlyPropertyType(propertyType)
  const showFloor = hasFloorInformation(propertyType)
  const showMezzanine = isStoreLikePropertyType(propertyType)
  const showStructure = isPavilionPropertyType(propertyType)
  const areaLabel = isLandOnly
    ? 'Metragem do terreno (m²)'
    : 'Área útil / construída (m²)'

  useEffect(() => {
    if (!isLandOnly) return
    const constructionDefaults = {
      bedrooms: 0,
      bathrooms: 0,
      parking: 0,
      lotArea: undefined,
      buildingAge: 'mais-10',
      conservation: 'bom',
      standardLevel: 'padrao',
      furnishing: 'sem',
      finishLevel: 'padrao',
      floor: undefined,
      totalFloors: undefined,
      elevatorAccess: undefined,
      hasMezzanine: undefined,
      structureType: undefined,
      highEndFurnitureValue: undefined,
    } as const
    for (const key of Object.keys(
      constructionDefaults
    ) as (keyof typeof constructionDefaults)[]) {
      form.setValue(key, constructionDefaults[key])
      form.clearErrors(key)
    }
    form.setValue(
      'amenities',
      form
        .getValues('amenities')
        .filter((value) =>
          [
            'vista-privilegiada',
            'portaria-24h',
            'seguranca',
            'area-lazer',
          ].includes(value)
        )
    )
  }, [isLandOnly, form])

  function updateAddressFromCep(
    lookup: CepLookupResult,
    streetNumber?: string
  ) {
    form.setValue(
      'address',
      composeAddressFromCep({
        ...lookup,
        streetNumber: streetNumber?.trim() || undefined,
      }),
      { shouldValidate: true }
    )
  }

  async function handleCepLookup(cep: string) {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return

    setCepLoading(true)
    try {
      const result = await lookupCep(digits)
      setCepLookup(result)
      updateAddressFromCep(result, form.getValues('streetNumber'))
      toast.success('Endereço preenchido automaticamente.')
    } catch {
      setCepLookup(null)
      toast.error('CEP não encontrado. Verifique e tente novamente.')
    } finally {
      setCepLoading(false)
    }
  }

  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const fieldsByStep: (keyof EvaluationFormValues)[][] = [
    [
      'listingIntent',
      'cep',
      'streetNumber',
      'address',
      'propertyType',
      'area',
      'lotArea',
      'conservation',
      'buildingAge',
      'bedrooms',
      'bathrooms',
      'parking',
      'askingPrice',
      'notes',
      'floor',
      'totalFloors',
      'elevatorAccess',
      'hasMezzanine',
      'structureType',
    ],
    [
      'standardLevel',
      'furnishing',
      'finishLevel',
      'condominiumLevel',
      'viewType',
      'amenities',
      'highEndFurnitureValue',
    ],
    [],
  ]
  function changeStep(step: number) {
    setWizardStep(step)
    setSubmissionError(null)
    requestAnimationFrame(() => {
      stepHeadingRef.current?.focus()
      stepHeadingRef.current?.scrollIntoView({ block: 'start' })
    })
  }
  async function advanceWizardStep() {
    const valid = await form.trigger(fieldsByStep[wizardStep - 1], {
      shouldFocus: true,
    })
    if (valid) changeStep(Math.min(wizardStep + 1, 3))
    else
      setSubmissionError(
        'Revise os campos destacados para continuar. Seus dados foram mantidos.'
      )
  }
  function onInvalid(errors: FieldErrors<EvaluationFormValues>) {
    const stepIndex = fieldsByStep.findIndex((fields) =>
      fields.some((field) => errors[field])
    )
    if (stepIndex >= 0) changeStep(stepIndex + 1)
    setSubmissionError(
      'Há informações incompletas. Revise os campos destacados antes de avaliar.'
    )
  }

  async function onSubmit(values: EvaluationFormValues) {
    // Evita submit acidental (Enter ou clique residual) fora da etapa de fotos.
    if (wizardStep < 3) {
      await advanceWizardStep()
      return
    }

    if (isBroker && credits < 5) {
      toast.error(
        CREDITS_AND_PLANS_ENABLED
          ? 'Você não tem créditos suficientes (5 por avaliação). Compre créditos em Configurações → Créditos.'
          : 'Você não tem créditos suficientes. A compra de créditos estará disponível em breve.'
      )
      return
    }

    if (isEvaluating) return
    setSubmissionError(null)
    setIsEvaluating(true)
    setResult(null)
    setEvaluatedProperty(null)
    setEvaluationId(null)
    setFeedbackSubmitted(false)
    setFloodFeedbackSubmitted(false)
    setEvaluatingStep('Analisando mercado')

    try {
      const {
        evaluation,
        evaluationId: newEvaluationId,
        feedbackModeEnabled: modeEnabled,
        trialEvaluationsRemaining,
        credits: responseCredits,
        pfCreditsEarned,
        gamification,
      } = await analyzeProperty(values, photos)
      setResult(evaluation)
      setEvaluatedProperty(values)
      setEvaluationId(newEvaluationId)
      setFeedbackModeEnabled(modeEnabled)
      updateCredits(responseCredits ?? trialEvaluationsRemaining)
      recordEvaluation()
      emitMyEvaluationsUpdated()
      showGamificationUpdates(gamification)
      if (pfCreditsEarned && pfCreditsEarned > 0) {
        toast.success(
          `Você ganhou +${pfCreditsEarned} crédito${pfCreditsEarned === 1 ? '' : 's'} por avaliar seu imóvel!`
        )
      }
      if (userId) {
        clearDraft(userId)
        setShowDraftBanner(false)
        setDraftUpdatedAt(null)
      }
      toast.success('Avaliação concluída com sucesso!')
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 403) {
        updateCredits(0)
      }
      if (error instanceof AxiosError && error.response?.status === 402) {
        const balance = (error.response?.data as { credits?: number })?.credits
        if (typeof balance === 'number') updateCredits(balance)
      }
      const message =
        error instanceof AxiosError
          ? (error.response?.data as { message?: string })?.message
          : error instanceof Error
            ? error.message
            : undefined
      setSubmissionError(
        message ??
          'Não foi possível concluir a avaliação. Seus dados foram mantidos; tente novamente.'
      )
      if (
        error instanceof AxiosError &&
        (error.response?.status === 402 || error.response?.status === 429)
      ) {
        toast.error(message ?? 'Créditos insuficientes para avaliar.', {
          action: CREDITS_AND_PLANS_ENABLED
            ? {
                label: 'Ver planos',
                onClick: () => {
                  void navigate({ to: '/settings/credits' })
                },
              }
            : undefined,
        })
      } else {
        toast.error(message ?? 'Erro ao avaliar imóvel. Tente novamente.')
      }
    } finally {
      setIsEvaluating(false)
      setEvaluatingStep('')
    }
  }

  return (
    <>
      <Header fixed>
        <HeaderActions />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>
            Avaliação de Imóveis
          </h2>
          <p className='text-muted-foreground'>
            Obtenha uma estimativa de valor com análise completa do imóvel e do
            mercado local.
            {credits != null && (
              <>
                {' '}
                {isBroker ? (
                  <>
                    Você tem{' '}
                    <strong>
                      {credits} crédito{credits === 1 ? '' : 's'}
                    </strong>{' '}
                    disponível{credits === 1 ? '' : 'eis'}.
                  </>
                ) : (
                  <>
                    Você tem{' '}
                    <strong>
                      {credits} crédito{credits === 1 ? '' : 's'}
                    </strong>
                    . Avalie imóveis e disponibilize para venda ou aluguel para
                    ganhar mais.
                  </>
                )}
              </>
            )}
          </p>
          {isBroker && credits < 5 && (
            <p className='mt-2 text-sm text-destructive'>
              Esta avaliação requer 5 créditos. Seu saldo é de {credits}.
              {CREDITS_AND_PLANS_ENABLED
                ? ' Consulte os planos em Configurações → Créditos.'
                : ' A compra de créditos estará disponível em breve.'}
            </p>
          )}
        </div>

        {showDraftBanner && draftUpdatedAt && (
          <EvaluationDraftBanner
            updatedAt={draftUpdatedAt}
            onDiscard={handleDiscardDraft}
          />
        )}

        <div className='flex flex-col gap-6'>
          {result && evaluatedProperty && (
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <p className='text-sm text-muted-foreground'>
                Avaliação concluída. Revise o resultado abaixo ou inicie outra.
              </p>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setResult(null)
                  setEvaluatedProperty(null)
                  setEvaluationId(null)
                  setFeedbackSubmitted(false)
                  setFloodFeedbackSubmitted(false)
                  setWizardStep(1)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                <Sparkles className='size-4' />
                Reavaliar este imóvel
              </Button>
            </div>
          )}

          {!result && (
            <>
              <EvaluationWizardSteps
                currentStep={wizardStep}
                onStepChange={changeStep}
                disabled={isEvaluating}
              />
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className='scroll-mt-24 text-xl font-semibold outline-none'
              >
                {wizardStep === 1
                  ? '1. Identifique o imóvel'
                  : wizardStep === 2
                    ? '2. Conte os diferenciais'
                    : '3. Adicione fotos e revise'}
              </h2>
              <p className='-mt-4 text-sm text-muted-foreground'>
                {wizardStep === 3
                  ? 'Fotos são opcionais. Confira o resumo antes de iniciar a pesquisa.'
                  : 'Preencha o que você conhece. Campos opcionais podem ficar em branco.'}
              </p>
              {submissionError && (
                <div
                  role='alert'
                  className='rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive'
                >
                  {submissionError}
                </div>
              )}
              {isEvaluating && (
                <div
                  role='status'
                  aria-live='polite'
                  className='rounded-xl border bg-muted/40 p-4 text-sm'
                >
                  Estamos pesquisando o mercado e preparando os comparáveis.
                  Isso pode levar alguns minutos. Mantenha esta página aberta.
                </div>
              )}
            </>
          )}
          {!result && (
            <div className='grid gap-6 lg:grid-cols-2'>
              <Form {...form}>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (wizardStep < 3) {
                      void advanceWizardStep()
                      return
                    }
                    void form.handleSubmit(onSubmit, onInvalid)(event)
                  }}
                  className='space-y-6'
                  aria-busy={isEvaluating}
                >
                  <fieldset
                    disabled={isEvaluating}
                    className='min-w-0 space-y-6'
                  >
                    {wizardStep === 1 && (
                      <>
                        <ListingIntentSelector control={form.control} />

                        <Card className='rounded-[1.75rem] border-0 shadow-sm'>
                          <CardHeader>
                            <CardTitle className='flex items-center gap-2'>
                              <Home className='size-5' />
                              Dados do imóvel
                            </CardTitle>
                            <CardDescription>
                              Informe as características básicas do imóvel
                            </CardDescription>
                          </CardHeader>
                          <CardContent className='space-y-4'>
                            <div className='grid gap-4 sm:grid-cols-2'>
                              <FormField
                                control={form.control}
                                name='cep'
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>CEP</FormLabel>
                                    <FormControl>
                                      <div className='relative'>
                                        <Input
                                          placeholder='00000-000'
                                          inputMode='numeric'
                                          maxLength={9}
                                          value={field.value ?? ''}
                                          onChange={(e) => {
                                            const formatted = formatCepInput(
                                              e.target.value
                                            )
                                            field.onChange(formatted)
                                            if (
                                              formatted.replace(/\D/g, '')
                                                .length === 8
                                            ) {
                                              void handleCepLookup(formatted)
                                            }
                                          }}
                                          onBlur={() => {
                                            if (field.value) {
                                              void handleCepLookup(field.value)
                                            }
                                          }}
                                        />
                                        {cepLoading && (
                                          <Loader2 className='absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground' />
                                        )}
                                      </div>
                                    </FormControl>
                                    <FormDescription>
                                      Preenche o endereço automaticamente
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name='streetNumber'
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Número</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder='Ex: 123'
                                        {...field}
                                        onChange={(e) => {
                                          field.onChange(e.target.value)
                                          if (cepLookup) {
                                            updateAddressFromCep(
                                              cepLookup,
                                              e.target.value
                                            )
                                          }
                                        }}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={form.control}
                              name='address'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className='flex items-center gap-2'>
                                    <MapPin className='size-4' />
                                    Endereço
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder='Rua, bairro, cidade — UF'
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Preenchido pelo CEP; você pode ajustar se
                                    necessário
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className='grid gap-4 sm:grid-cols-2'>
                              <FormField
                                control={form.control}
                                name='propertyType'
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Tipo</FormLabel>
                                    <Select
                                      onValueChange={(value) => {
                                        field.onChange(value)
                                        if (!hasFloorInformation(value)) {
                                          form.setValue('floor', undefined)
                                          form.setValue(
                                            'totalFloors',
                                            undefined
                                          )
                                          form.setValue(
                                            'elevatorAccess',
                                            undefined
                                          )
                                        }
                                        if (!isStoreLikePropertyType(value)) {
                                          form.setValue(
                                            'hasMezzanine',
                                            undefined
                                          )
                                        }
                                        if (!isPavilionPropertyType(value)) {
                                          form.setValue(
                                            'structureType',
                                            undefined
                                          )
                                        }
                                      }}
                                      value={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder='Selecione' />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent className='max-h-72'>
                                        {propertyTypeGroups.map((group) => (
                                          <SelectGroup key={group.label}>
                                            <SelectLabel>
                                              {group.label}
                                            </SelectLabel>
                                            {group.types.map((type) => (
                                              <SelectItem
                                                key={type.value}
                                                value={type.value}
                                              >
                                                {type.label}
                                              </SelectItem>
                                            ))}
                                          </SelectGroup>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {!isLandOnly && (
                                <FormField
                                  control={form.control}
                                  name='conservation'
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Conservação</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder='Selecione' />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {conservationStates.map((state) => (
                                            <SelectItem
                                              key={state.value}
                                              value={state.value}
                                            >
                                              {state.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                            </div>

                            {(showFloor || showMezzanine || showStructure) && (
                              <div className='grid gap-4 sm:grid-cols-2'>
                                {showFloor && (
                                  <FormField
                                    control={form.control}
                                    name='floor'
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Andar</FormLabel>
                                        <FormControl>
                                          <Input
                                            type='number'
                                            min={0}
                                            placeholder='Ex: 3'
                                            value={field.value ?? ''}
                                            onChange={(e) =>
                                              field.onChange(
                                                e.target.value === ''
                                                  ? undefined
                                                  : Number(e.target.value)
                                              )
                                            }
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          Use 0 para térreo. Em duplex/triplex,
                                          informe o piso de acesso da unidade.
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}

                                {showFloor && (
                                  <>
                                    <FormField
                                      control={form.control}
                                      name='totalFloors'
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>
                                            Último andar do prédio
                                          </FormLabel>
                                          <FormControl>
                                            <Input
                                              type='number'
                                              min={0}
                                              max={200}
                                              step={1}
                                              value={field.value ?? ''}
                                              onChange={(e) =>
                                                field.onChange(
                                                  e.target.value === ''
                                                    ? undefined
                                                    : Number(e.target.value)
                                                )
                                              }
                                              placeholder='Ex.: 12'
                                            />
                                          </FormControl>
                                          <FormDescription>
                                            Opcional. Numeração do último andar,
                                            sem contar subsolos.
                                          </FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={form.control}
                                      name='elevatorAccess'
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>
                                            Elevador atende este andar?
                                          </FormLabel>
                                          <Select
                                            value={
                                              field.value ?? 'desconhecido'
                                            }
                                            onValueChange={field.onChange}
                                          >
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              <SelectItem value='desconhecido'>
                                                Não informado
                                              </SelectItem>
                                              <SelectItem value='sim'>
                                                Sim
                                              </SelectItem>
                                              <SelectItem value='nao'>
                                                Não
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <FormDescription>
                                            Andar alto não garante valorização.
                                            Acesso, vista e comparáveis locais
                                            são analisados em conjunto.
                                          </FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </>
                                )}

                                {showMezzanine && (
                                  <FormField
                                    control={form.control}
                                    name='hasMezzanine'
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Tem mezanino?</FormLabel>
                                        <div className='flex gap-2'>
                                          <Button
                                            type='button'
                                            variant={
                                              field.value === true
                                                ? 'default'
                                                : 'outline'
                                            }
                                            onClick={() => field.onChange(true)}
                                          >
                                            Sim
                                          </Button>
                                          <Button
                                            type='button'
                                            variant={
                                              field.value === false
                                                ? 'default'
                                                : 'outline'
                                            }
                                            onClick={() =>
                                              field.onChange(false)
                                            }
                                          >
                                            Não
                                          </Button>
                                        </div>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}

                                {showStructure && (
                                  <FormField
                                    control={form.control}
                                    name='structureType'
                                    render={({ field }) => (
                                      <FormItem className='sm:col-span-2'>
                                        <FormLabel>
                                          Estrutura do pavilhão
                                        </FormLabel>
                                        <div className='flex flex-wrap gap-2'>
                                          {structureTypeOptions.map(
                                            (option) => (
                                              <Button
                                                key={option.value}
                                                type='button'
                                                variant={
                                                  field.value === option.value
                                                    ? 'default'
                                                    : 'outline'
                                                }
                                                onClick={() =>
                                                  field.onChange(option.value)
                                                }
                                              >
                                                {option.label}
                                              </Button>
                                            )
                                          )}
                                        </div>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}
                              </div>
                            )}

                            <div className='grid gap-4 sm:grid-cols-2'>
                              <FormField
                                control={form.control}
                                name='area'
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{areaLabel}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type='number'
                                        {...field}
                                        onChange={(e) =>
                                          field.onChange(Number(e.target.value))
                                        }
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {showLotArea && (
                                <FormField
                                  control={form.control}
                                  name='lotArea'
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Metragem do terreno (m²)
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          type='number'
                                          placeholder='Ex: 360'
                                          value={field.value ?? ''}
                                          onChange={(e) =>
                                            field.onChange(
                                              e.target.value
                                                ? Number(e.target.value)
                                                : undefined
                                            )
                                          }
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}

                              {!isLandOnly && (
                                <FormField
                                  control={form.control}
                                  name='buildingAge'
                                  render={({ field }) => (
                                    <FormItem
                                      className={
                                        showLotArea ? 'sm:col-span-2' : ''
                                      }
                                    >
                                      <FormLabel>Idade da construção</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder='Selecione' />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {buildingAgeOptions.map((option) => (
                                            <SelectItem
                                              key={option.value}
                                              value={option.value}
                                            >
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                            </div>

                            {!isLandOnly && (
                              <div className='grid gap-4 sm:grid-cols-3'>
                                <FormField
                                  control={form.control}
                                  name='bedrooms'
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Quartos</FormLabel>
                                      <FormControl>
                                        <Input
                                          type='number'
                                          {...field}
                                          onChange={(e) =>
                                            field.onChange(
                                              Number(e.target.value)
                                            )
                                          }
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name='bathrooms'
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Banheiros</FormLabel>
                                      <FormControl>
                                        <Input
                                          type='number'
                                          {...field}
                                          onChange={(e) =>
                                            field.onChange(
                                              Number(e.target.value)
                                            )
                                          }
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name='parking'
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Vagas</FormLabel>
                                      <FormControl>
                                        <Input
                                          type='number'
                                          {...field}
                                          onChange={(e) =>
                                            field.onChange(
                                              Number(e.target.value)
                                            )
                                          }
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}

                            <FormField
                              control={form.control}
                              name='askingPrice'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Valor pedido (opcional)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type='number'
                                      placeholder='Ex: 450000'
                                      value={field.value ?? ''}
                                      onChange={(e) =>
                                        field.onChange(
                                          e.target.value
                                            ? Number(e.target.value)
                                            : undefined
                                        )
                                      }
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Informe para comparar com a estimativa da IA
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name='notes'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Observações</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder={
                                        isLandOnly
                                          ? 'Topografia, acesso, infraestrutura e outros detalhes do terreno...'
                                          : 'Detalhes adicionais sobre o imóvel...'
                                      }
                                      className='min-h-20'
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>
                      </>
                    )}

                    {wizardStep === 2 && (
                      <Card className='rounded-[1.75rem] border-0 shadow-sm'>
                        <CardHeader>
                          <CardTitle className='flex items-center gap-2'>
                            <Gem className='size-5' />
                            Características e diferenciais
                          </CardTitle>
                          <CardDescription>
                            {isLandOnly
                              ? 'Informações de condomínio, vista e diferenciais do terreno'
                              : 'Informações de padrão, acabamento e amenidades para uma avaliação mais precisa'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                          <div className='grid gap-4 sm:grid-cols-2'>
                            {!isLandOnly && (
                              <>
                                <FormField
                                  control={form.control}
                                  name='standardLevel'
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Padrão do imóvel</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder='Selecione' />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {standardLevels.map((level) => (
                                            <SelectItem
                                              key={level.value}
                                              value={level.value}
                                            >
                                              {level.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name='furnishing'
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Mobília</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder='Selecione' />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {furnishingOptions.map((option) => (
                                            <SelectItem
                                              key={option.value}
                                              value={option.value}
                                            >
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name='finishLevel'
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Acabamento</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder='Selecione' />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {finishLevels.map((level) => (
                                            <SelectItem
                                              key={level.value}
                                              value={level.value}
                                            >
                                              {level.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </>
                            )}
                            <FormField
                              control={form.control}
                              name='condominiumLevel'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Condomínio</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder='Selecione' />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {condominiumLevels.map((level) => (
                                        <SelectItem
                                          key={level.value}
                                          value={level.value}
                                        >
                                          {level.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name='viewType'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Vista</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder='Selecione (opcional)' />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {viewTypes.map((view) => (
                                      <SelectItem
                                        key={view.value}
                                        value={view.value}
                                      >
                                        {view.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div>
                            <FormLabel className='mb-3 block'>
                              Diferenciais e amenidades
                            </FormLabel>
                            <div className='grid gap-3 sm:grid-cols-2'>
                              {propertyAmenities
                                .filter(
                                  (amenity) =>
                                    !isLandOnly ||
                                    [
                                      'vista-privilegiada',
                                      'portaria-24h',
                                      'seguranca',
                                      'area-lazer',
                                    ].includes(amenity.value)
                                )
                                .map((amenity) => (
                                  <FormField
                                    key={amenity.value}
                                    control={form.control}
                                    name='amenities'
                                    render={({ field }) => (
                                      <FormItem className='flex items-center gap-2 space-y-0'>
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(
                                              amenity.value
                                            )}
                                            onCheckedChange={(checked) => {
                                              const current = field.value ?? []
                                              field.onChange(
                                                checked
                                                  ? [...current, amenity.value]
                                                  : current.filter(
                                                      (value) =>
                                                        value !== amenity.value
                                                    )
                                              )
                                              if (
                                                !checked &&
                                                amenity.value ===
                                                  HIGH_END_FURNITURE_AMENITY
                                              ) {
                                                form.setValue(
                                                  'highEndFurnitureValue',
                                                  undefined
                                                )
                                              }
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className='cursor-pointer font-normal'>
                                          {amenity.label}
                                        </FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                ))}
                            </div>
                          </div>

                          {!isLandOnly && hasHighEndFurniture && (
                            <FormField
                              control={form.control}
                              name='highEndFurnitureValue'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    Valor estimado dos móveis (todos juntos)
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type='number'
                                      placeholder='Ex: 85000'
                                      value={field.value ?? ''}
                                      onChange={(e) =>
                                        field.onChange(
                                          e.target.value
                                            ? Number(e.target.value)
                                            : undefined
                                        )
                                      }
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Soma estimada de todos os móveis alto padrão
                                    do imóvel
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {wizardStep === 3 && (
                      <Card className='rounded-[1.75rem] border-0 shadow-sm'>
                        <CardHeader>
                          <CardTitle className='flex items-center gap-2'>
                            <Camera className='size-5' />
                            {isLandOnly
                              ? 'Fotos do terreno'
                              : 'Fotos do imóvel'}
                          </CardTitle>
                          <CardDescription>
                            {isLandOnly
                              ? 'Envie fotos do terreno, dos acessos e do entorno'
                              : 'Envie fotos para a IA analisar acabamentos, conservação e apresentação visual'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <PhotoUpload photos={photos} onChange={setPhotos} />
                        </CardContent>
                      </Card>
                    )}

                    <div className='sticky bottom-0 z-10 -mx-1 flex gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80'>
                      {wizardStep > 1 && (
                        <Button
                          type='button'
                          variant='outline'
                          className='flex-1 rounded-full'
                          onClick={() => changeStep(wizardStep - 1)}
                        >
                          Voltar
                        </Button>
                      )}
                      {wizardStep < 3 ? (
                        <Button
                          type='button'
                          className='flex-1 rounded-full bg-flux-lime font-semibold text-flux-dark hover:bg-flux-lime/90'
                          onClick={() => void advanceWizardStep()}
                        >
                          Continuar
                        </Button>
                      ) : (
                        <Button
                          key='evaluate-submit'
                          type='button'
                          size='lg'
                          className='flex-1 rounded-full bg-flux-lime font-semibold text-flux-dark hover:bg-flux-lime/90'
                          disabled={isEvaluating || (isBroker && credits < 5)}
                          onClick={() =>
                            void form.handleSubmit(onSubmit, onInvalid)()
                          }
                        >
                          {isEvaluating ? (
                            <>
                              <Loader2 className='size-4 animate-spin' />
                              {evaluatingStep || 'Analisando mercado'}
                            </>
                          ) : (
                            <>
                              <Sparkles className='size-4' />
                              Avaliar com IA
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </fieldset>
                </form>
              </Form>

              <EvaluationReview
                control={form.control}
                photoCount={photos.length}
                currentStep={wizardStep}
                busy={isEvaluating}
                cost={isBroker ? 5 : null}
                onEdit={changeStep}
              />
            </div>
          )}

          {result && evaluatedProperty && (
            <div
              ref={resultRef}
              tabIndex={-1}
              aria-label='Resultado da avaliação'
              className='scroll-mt-24 space-y-6 outline-none'
            >
              <EvaluationResultPanel
                result={result}
                property={evaluatedProperty}
              />
              {evaluatedProperty.address && !floodFeedbackSubmitted && (
                <FloodExperienceFeedback
                  evaluationId={evaluationId}
                  address={evaluatedProperty.address}
                  onUpdated={() => setFloodFeedbackSubmitted(true)}
                />
              )}
              {!isBroker && evaluationId && (
                <PublishPropertyLead
                  key={evaluationId}
                  evaluationId={evaluationId}
                  listingIntent={evaluatedProperty.listingIntent}
                />
              )}
              {feedbackModeEnabled && evaluationId && !feedbackSubmitted && (
                <EvaluationFeedbackPanel
                  evaluationId={evaluationId}
                  onSubmitted={() => setFeedbackSubmitted(true)}
                />
              )}
            </div>
          )}
        </div>
      </Main>
    </>
  )
}
