import { useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { LucideIcon } from 'lucide-react'

type AdminSidebarNavProps = {
  pathname: string
  items: {
    href: string
    title: string
    icon: LucideIcon
  }[]
}

export function AdminSidebarNav({ items, pathname }: AdminSidebarNavProps) {
  const navigate = useNavigate()
  const activeHref =
    items.find((item) =>
      item.href === '/admin'
        ? pathname === '/admin'
        : pathname.startsWith(item.href)
    )?.href ?? '/admin'
  const [val, setVal] = useState(activeHref)

  const handleSelect = (href: string) => {
    setVal(href)
    navigate({ to: href })
  }

  return (
    <>
      <div className='p-1 md:hidden'>
        <Select value={val} onValueChange={handleSelect}>
          <SelectTrigger className='h-12 sm:w-48'>
            <SelectValue placeholder='Seção admin' />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => {
              const Icon = item.icon
              return (
                <SelectItem key={item.href} value={item.href}>
                  <div className='flex gap-x-3 px-2 py-1'>
                    <Icon className='size-4' />
                    <span>{item.title}</span>
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea
        orientation='horizontal'
        type='always'
        className='hidden w-full min-w-40 bg-background px-1 py-2 md:block'
      >
        <nav className='flex space-x-2 py-1 lg:flex-col lg:space-y-1 lg:space-x-0'>
          {items.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  buttonVariants({ variant: 'ghost' }),
                  isActive
                    ? 'bg-muted hover:bg-accent'
                    : 'hover:bg-accent hover:underline',
                  'justify-start'
                )}
              >
                <Icon className='me-2 size-4 shrink-0' />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </>
  )
}
