import { Link } from '@tanstack/react-router'
import { Clock, Telescope } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type ComingSoonProps = {
  title?: string
  description?: string
  className?: string
  showBackLink?: boolean
  variant?: 'page' | 'card'
}

export function ComingSoon({
  title = 'Em breve',
  description = 'Esta funcionalidade ainda está em desenvolvimento. Volte em breve!',
  className,
  showBackLink = true,
  variant = 'page',
}: ComingSoonProps) {
  if (variant === 'card') {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardHeader className='items-center text-center'>
          <div className='flex size-14 items-center justify-center rounded-full bg-primary/10'>
            <Clock className='size-7 text-primary' />
          </div>
          <CardTitle className='text-2xl'>{title}</CardTitle>
          <CardDescription className='max-w-md text-base'>
            {description}
          </CardDescription>
        </CardHeader>
        {showBackLink && (
          <CardContent className='flex justify-center pb-8'>
            <Button variant='outline' asChild>
              <Link to='/'>Voltar ao dashboard</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <div className={cn('flex flex-1 items-center justify-center', className)}>
      <div className='m-auto flex w-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center'>
        <div className='flex size-20 items-center justify-center rounded-full bg-primary/10'>
          <Telescope className='size-10 text-primary' />
        </div>
        <h1 className='text-4xl leading-tight font-bold'>{title}</h1>
        <p className='text-muted-foreground'>{description}</p>
        {showBackLink && (
          <Button variant='outline' asChild className='mt-2'>
            <Link to='/'>Voltar ao dashboard</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
