import { useState } from 'react'
import { Shuffle } from 'lucide-react'
import { AvaliaLogo } from '@/assets/avalia-logo'
import { MeshShader, type Palette } from './mesh-shader'

export const PALETTES: Palette[] = [
  {
    name: 'Forest',
    colors: [
      [0.04, 0.09, 0.07],
      [0.08, 0.32, 0.26],
      [0.1, 0.2, 0.32],
      [0.05, 0.11, 0.1],
    ],
  },
  {
    name: 'Aurora',
    colors: [
      [0.05, 0.08, 0.16],
      [0.1, 0.32, 0.48],
      [0.42, 0.2, 0.58],
      [0.06, 0.1, 0.18],
    ],
  },
  {
    name: 'Slate',
    colors: [
      [0.04, 0.04, 0.07],
      [0.13, 0.13, 0.17],
      [0.22, 0.22, 0.3],
      [0.06, 0.06, 0.1],
    ],
  },
  {
    name: 'Plum',
    colors: [
      [0.1, 0.05, 0.14],
      [0.5, 0.16, 0.5],
      [0.26, 0.1, 0.42],
      [0.08, 0.04, 0.12],
    ],
  },
]

type AuthLeftPanelProps = {
  defaultPaletteIndex?: number
}

export function AuthLeftPanel({ defaultPaletteIndex = 0 }: AuthLeftPanelProps) {
  const [paletteIndex, setPaletteIndex] = useState(defaultPaletteIndex)
  const palette = PALETTES[paletteIndex]

  const shuffle = () => {
    setPaletteIndex((current) => {
      let next = current
      while (next === current) {
        next = Math.floor(Math.random() * PALETTES.length)
      }
      return next
    })
  }

  return (
    <div className='relative hidden overflow-hidden bg-[#0a0a0c] lg:block'>
      <MeshShader palette={palette} />
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0'
        style={{
          background:
            'radial-gradient(120% 80% at 50% 50%, transparent 35%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      <div className='relative flex h-full flex-col justify-between p-12'>
        <div className='flex items-start justify-between'>
          <AvaliaLogo size='md' className='rounded-md' />
          <button
            type='button'
            onClick={shuffle}
            className='group inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-white/75 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-black/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30'
          >
            <Shuffle className='size-3.5 transition-transform group-hover:rotate-12' />
            <span className='font-mono text-[10px] uppercase tracking-[0.2em]'>
              {palette.name}
            </span>
          </button>
        </div>

        <div className='max-w-md'>
          <h2
            className='text-3xl leading-tight font-semibold md:text-4xl'
            style={{ textShadow: '0 1px 24px rgba(0,0,0,0.55)' }}
          >
            <span className='text-white'>Avalia Imob.</span>
            <br />
            <span className='text-white/55'>Avalie imóveis com</span>{' '}
            <span className='text-white'>inteligência</span>{' '}
            <span className='text-white/55'>artificial.</span>
          </h2>
          <p
            className='mt-5 max-w-sm text-sm leading-relaxed text-white/65'
            style={{ textShadow: '0 1px 16px rgba(0,0,0,0.55)' }}
          >
            Leads do WhatsApp, avaliações com IA e gestão de créditos — tudo
            para o corretor moderno.
          </p>
        </div>
      </div>
    </div>
  )
}

export function AvaliaBrandMark() {
  return <AvaliaLogo size='lg' />
}
