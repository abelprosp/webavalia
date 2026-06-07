import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  fetchAdminSettings,
  updateAdminSettings,
  type PlatformSettings,
} from '@/lib/admin-api'

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchAdminSettings()
      .then(setSettings)
      .catch(() => toast.error('Erro ao carregar configurações.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      const updated = await updateAdminSettings(settings)
      setSettings(updated)
      toast.success('Configurações salvas.')
    } catch {
      toast.error('Erro ao salvar configurações.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <Loader2 className='size-4 animate-spin' />
        Carregando configurações...
      </div>
    )
  }

  if (!settings) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações da plataforma</CardTitle>
        <CardDescription>
          Parâmetros globais para cadastro, trial e créditos iniciais
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label>Avaliações grátis por cadastro</Label>
            <Input
              type='number'
              min={0}
              value={settings.trialEvaluationsTotal}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  trialEvaluationsTotal: Number(e.target.value),
                })
              }
            />
          </div>
          <div className='space-y-2'>
            <Label>Créditos iniciais de leads</Label>
            <Input
              type='number'
              min={0}
              value={settings.defaultLeadCredits}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultLeadCredits: Number(e.target.value),
                })
              }
            />
          </div>
        </div>

        <div className='flex items-center justify-between rounded-lg border p-4'>
          <div>
            <Label>Modo experimental de feedback na avaliação</Label>
            <p className='text-sm text-muted-foreground'>
              Permite que corretores avaliem se a IA acertou ou errou, para
              calibrar próximas análises
            </p>
          </div>
          <Switch
            checked={settings.evaluationFeedbackMode}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, evaluationFeedbackMode: checked })
            }
          />
        </div>

        <div className='flex items-center justify-between rounded-lg border p-4'>
          <div>
            <Label>Cadastro público habilitado</Label>
            <p className='text-sm text-muted-foreground'>
              Permite que novos corretores criem conta em /sign-up
            </p>
          </div>
          <Switch
            checked={settings.registrationEnabled}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, registrationEnabled: checked })
            }
          />
        </div>

        <Button onClick={handleSave} disabled={saving}>
          Salvar configurações
        </Button>
      </CardContent>
    </Card>
  )
}
