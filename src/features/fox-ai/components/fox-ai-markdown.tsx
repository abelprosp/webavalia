import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type FoxAiMarkdownProps = {
  content: string
  className?: string
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className='font-semibold'>
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

export function FoxAiMarkdown({ content, className }: FoxAiMarkdownProps) {
  const lines = content.split('\n')
  const elements: ReactNode[] = []
  let listItems: string[] = []
  let listKey = 0

  function flushList() {
    if (listItems.length === 0) return
    elements.push(
      <ul key={`list-${listKey++}`} className='my-2 list-disc space-y-1 ps-4'>
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    )
    listItems = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2))
      continue
    }

    flushList()

    if (!trimmed) {
      elements.push(<br key={`br-${i}`} />)
      continue
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={i} className='mt-3 mb-1 text-sm font-semibold'>
          {renderInline(trimmed.slice(4))}
        </h4>
      )
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={i} className='mt-3 mb-1 text-sm font-semibold'>
          {renderInline(trimmed.slice(3))}
        </h3>
      )
    } else if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={i} className='mt-3 mb-1 text-base font-semibold'>
          {renderInline(trimmed.slice(2))}
        </h2>
      )
    } else {
      elements.push(
        <p key={i} className='my-1'>
          {renderInline(trimmed)}
        </p>
      )
    }
  }

  flushList()

  return (
    <div className={cn('text-sm leading-relaxed', className)}>{elements}</div>
  )
}
