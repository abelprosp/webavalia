import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ExternalLink, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { FoxAiChat } from './fox-ai-chat'
import type { DashboardContext } from '@/lib/fox-ai-api'

type FoxAiWidgetProps = {
  dashboardContext?: DashboardContext
}

export function FoxAiWidget({ dashboardContext }: FoxAiWidgetProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        size='lg'
        className='fixed bottom-6 end-6 z-50 size-14 rounded-full bg-orange-500 shadow-lg hover:bg-orange-600'
        onClick={() => setOpen(true)}
        aria-label='Abrir FoxAi'
      >
        <Sparkles className='size-6' />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side='right'
          className='flex w-full flex-col sm:max-w-md'
        >
          <SheetHeader>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div className='flex size-8 items-center justify-center rounded-full bg-orange-500/10'>
                  <Sparkles className='size-4 text-orange-500' />
                </div>
                <div>
                  <SheetTitle>FoxAi</SheetTitle>
                  <SheetDescription>
                    Especialista em imóveis · NVIDIA NIM
                  </SheetDescription>
                </div>
              </div>
              <Button variant='ghost' size='icon' asChild>
                <Link to='/fox-ai'>
                  <ExternalLink className='size-4' />
                </Link>
              </Button>
            </div>
          </SheetHeader>

          <div className='flex flex-1 flex-col overflow-hidden pt-4'>
            <FoxAiChat
              compact
              dashboardContext={{
                ...dashboardContext,
                currentPage: dashboardContext?.currentPage ?? 'widget',
              }}
            />
          </div>

          <Button
            variant='ghost'
            size='sm'
            className='mt-2 self-center text-muted-foreground'
            onClick={() => setOpen(false)}
          >
            <X className='me-1 size-3' />
            Fechar
          </Button>
        </SheetContent>
      </Sheet>
    </>
  )
}
