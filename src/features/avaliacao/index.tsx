import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Sparkles, Home, Loader2, Camera, Gem } from 'lucide-react'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { analyzeProperty } from '@/lib/evaluation-api'
import { showGamificationUpdates } from '@/features/gamification/lib/show-gamification-toasts'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreditsBadge } from '@/components/credits-badge'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  condominiumLevels,
  conservationStates,
  finishLevels,
  furnishingOptions,
  propertyAmenities,
  propertyTypeGroups,
  standardLevels,
  viewTypes,
} from './data/criteria'
import {
  evaluationFormSchema,
  type EvaluationFormValues,
  type EvaluationResult,
} from './data/evaluation-engine'
import { useEvaluationsStore } from '@/stores/evaluations-store'
import { useAuthStore } from '@/stores/auth-store'
import { EvaluationResultPanel } from './components/evaluation-result'
import { EvaluationFeedbackPanel } from './components/evaluation-feedback'
import {
  PhotoUpload,
  type EvaluationPhoto,
} from './components/photo-upload'

const defaultValues: EvaluationFormValues = {
  address: '',
  propertyType: 'apartamento',
  area: 70,
  bedrooms: 2,
  bathrooms: 1,
  parking: 1,
  yearBuilt: 2015,
  conservation: 'bom',
  standardLevel: 'padrao',
  furnishing: 'sem',
  finishLevel: 'padrao',
  condominiumLevel: 'nao-aplica',
  viewType: undefined,
  amenities: [],
  askingPrice: undefined,
  notes: '',
}

export function Avaliacao() {
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [evaluatedProperty, setEvaluatedProperty] =
    useState<EvaluationFormValues | null>(null)
  const [evaluationId, setEvaluationId] = useState<string | null>(null)
  const [feedbackModeEnabled, setFeedbackModeEnabled] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluatingStep, setEvaluatingStep] = useState('')
  const [photos, setPhotos] = useState<EvaluationPhoto[]>([])
  const recordEvaluation = useEvaluationsStore((s) => s.recordEvaluation)
  const trialRemaining = useAuthStore(
    (s) => s.auth.user?.trialEvaluationsRemaining
  )
  const updateTrialRemaining = useAuthStore(
    (s) => s.auth.updateTrialEvaluationsRemaining
  )
  const photosRef = useRef(photos)
  photosRef.current = photos

  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
  }, [])

  const form = useForm<EvaluationFormValues>({
    resolver: zodResolver(evaluationFormSchema),
    defaultValues,
  })

  async function onSubmit(values: EvaluationFormValues) {
    if (trialRemaining != null && trialRemaining <= 0) {
      toast.error(
        'Suas 3 avaliações grátis de teste foram utilizadas. Entre em contato para continuar.'
      )
      return
    }

    setIsEvaluating(true)
    setResult(null)
    setEvaluatedProperty(null)
    setEvaluationId(null)
    setFeedbackSubmitted(false)
    setEvaluatingStep('Pesquisando o mercado local...')

    try {
      setEvaluatingStep('Gerando análise completa...')
      const {
        evaluation,
        evaluationId: newEvaluationId,
        feedbackModeEnabled: modeEnabled,
        trialEvaluationsRemaining,
        gamification,
      } = await analyzeProperty(values, photos)
      setResult(evaluation)
      setEvaluatedProperty(values)
      setEvaluationId(newEvaluationId)
      setFeedbackModeEnabled(modeEnabled)
      updateTrialRemaining(trialEvaluationsRemaining)
      recordEvaluation()
      showGamificationUpdates(gamification)
      toast.success('Avaliação concluída com sucesso!')
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 403) {
        updateTrialRemaining(0)
      }
      const message =
        error instanceof AxiosError
          ? (error.response?.data as { message?: string })?.message
          : error instanceof Error
            ? error.message
            : undefined
      toast.error(message ?? 'Erro ao avaliar imóvel. Tente novamente.')
    } finally {
      setIsEvaluating(false)
      setEvaluatingStep('')
    }
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <CreditsBadge />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>
            Avaliação de Imóveis
          </h2>
          <p className='text-muted-foreground'>
            Obtenha uma estimativa de valor com análise completa do imóvel e do
            mercado local.
            {trialRemaining != null && (
              <>
                {' '}
                Você tem{' '}
                <strong>
                  {trialRemaining} avaliação{trialRemaining === 1 ? '' : 'ões'}{' '}
                  grátis
                </strong>{' '}
                restante{trialRemaining === 1 ? '' : 's'}.
              </>
            )}
          </p>
          {trialRemaining === 0 && (
            <p className='mt-2 text-sm text-destructive'>
              Suas avaliações grátis de teste acabaram. Entre em contato para
              continuar usando a plataforma.
            </p>
          )}
        </div>

        <div className='grid gap-6 lg:grid-cols-2'>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              <Card>
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
                  <FormField
                    control={form.control}
                    name='address'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='Rua, número, bairro, cidade'
                            {...field}
                          />
                        </FormControl>
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
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder='Selecione' />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className='max-h-72'>
                              {propertyTypeGroups.map((group) => (
                                <SelectGroup key={group.label}>
                                  <SelectLabel>{group.label}</SelectLabel>
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
                                <SelectItem key={state.value} value={state.value}>
                                  {state.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className='grid gap-4 sm:grid-cols-2'>
                    <FormField
                      control={form.control}
                      name='area'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Área (m²)</FormLabel>
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
                    <FormField
                      control={form.control}
                      name='yearBuilt'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ano de construção</FormLabel>
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
                  </div>

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
                                field.onChange(Number(e.target.value))
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
                                field.onChange(Number(e.target.value))
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
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                            placeholder='Detalhes adicionais sobre o imóvel...'
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

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Gem className='size-5' />
                    Características e diferenciais
                  </CardTitle>
                  <CardDescription>
                    Informações de padrão, acabamento e amenidades para uma
                    avaliação mais precisa
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='grid gap-4 sm:grid-cols-2'>
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
                              <SelectItem key={view.value} value={view.value}>
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
                      {propertyAmenities.map((amenity) => (
                        <FormField
                          key={amenity.value}
                          control={form.control}
                          name='amenities'
                          render={({ field }) => (
                            <FormItem className='flex items-center gap-2 space-y-0'>
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(amenity.value)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value ?? []
                                    field.onChange(
                                      checked
                                        ? [...current, amenity.value]
                                        : current.filter(
                                            (value) => value !== amenity.value
                                          )
                                    )
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Camera className='size-5' />
                    Fotos do imóvel
                  </CardTitle>
                  <CardDescription>
                    Envie fotos para a IA analisar acabamentos, conservação e
                    apresentação visual
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PhotoUpload photos={photos} onChange={setPhotos} />
                </CardContent>
              </Card>

              <Button
                type='submit'
                size='lg'
                className='w-full'
                disabled={isEvaluating || trialRemaining === 0}
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className='size-4 animate-spin' />
                    {evaluatingStep || 'Analisando com IA...'}
                  </>
                ) : (
                  <>
                    <Sparkles className='size-4' />
                    Avaliar com IA
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className='space-y-6'>
            {result && evaluatedProperty ? (
              <>
                <EvaluationResultPanel
                  result={result}
                  property={evaluatedProperty}
                />
                {feedbackModeEnabled && evaluationId && !feedbackSubmitted && (
                  <EvaluationFeedbackPanel
                    evaluationId={evaluationId}
                    onSubmitted={() => setFeedbackSubmitted(true)}
                  />
                )}
              </>
            ) : (
              <Card className='flex min-h-100 flex-col items-center justify-center border-dashed'>
                <CardContent className='flex flex-col items-center gap-4 py-12 text-center'>
                  <div className='flex size-16 items-center justify-center rounded-full bg-primary/10'>
                    <Sparkles className='size-8 text-primary' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold'>
                      Resultado da avaliação
                    </h3>
                    <p className='mt-1 max-w-sm text-sm text-muted-foreground'>
                      Preencha os dados do imóvel e clique em
                      &quot;Avaliar com IA&quot; para obter a estimativa de
                      valor.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </Main>
    </>
  )
}
