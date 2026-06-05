import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Sparkles, Home, Loader2, Camera } from 'lucide-react'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { analyzeProperty } from '@/lib/evaluation-api'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
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
import { conservationStates, evaluationCriteria, propertyTypes } from './data/criteria'
import {
  evaluationFormSchema,
  type EvaluationFormValues,
  type EvaluationResult,
} from './data/evaluation-engine'
import { useEvaluationsStore } from '@/stores/evaluations-store'
import { CriteriaSlider } from './components/criteria-slider'
import { EvaluationResultPanel } from './components/evaluation-result'
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
  askingPrice: undefined,
  location: 3,
  infrastructure: 3,
  condition: 3,
  layout: 3,
  market: 3,
  documentation: 3,
  notes: '',
}

export function Avaliacao() {
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [evaluatedProperty, setEvaluatedProperty] =
    useState<EvaluationFormValues | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluatingStep, setEvaluatingStep] = useState('')
  const [photos, setPhotos] = useState<EvaluationPhoto[]>([])
  const recordEvaluation = useEvaluationsStore((s) => s.recordEvaluation)
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
    setIsEvaluating(true)
    setResult(null)
    setEvaluatedProperty(null)
    setEvaluatingStep('Pesquisando o mercado local...')

    try {
      setEvaluatingStep('Gerando análise completa...')
      const evaluation = await analyzeProperty(values, photos)
      setResult(evaluation)
      setEvaluatedProperty(values)
      recordEvaluation()
      toast.success('Avaliação concluída com sucesso!')
    } catch (error) {
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
          </p>
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
                            <SelectContent>
                              {propertyTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
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

              <Card>
                <CardHeader>
                  <CardTitle>Critérios de avaliação</CardTitle>
                  <CardDescription>
                    Avalie cada critério de 1 (baixo) a 5 (excelente)
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                  {evaluationCriteria.map((criterion) => (
                    <FormField
                      key={criterion.id}
                      control={form.control}
                      name={criterion.id}
                      render={({ field }) => (
                        <CriteriaSlider
                          label={criterion.label}
                          description={criterion.description}
                          value={field.value as number}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  ))}

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

              <Button type='submit' size='lg' className='w-full' disabled={isEvaluating}>
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
              <EvaluationResultPanel
                result={result}
                property={evaluatedProperty}
              />
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
                      Preencha os dados e critérios do imóvel e clique em
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
