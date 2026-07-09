import { Link } from '@tanstack/react-router'
import { ArrowLeft, Calendar, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BlogPost } from '@/lib/blog-api'

type BlogPostPageProps = {
  post: BlogPost
}

function formatDate(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function BlogPostPage({ post }: BlogPostPageProps) {
  return (
    <article className='space-y-6'>
      <Button variant='ghost' size='sm' className='-ms-2 rounded-full' asChild>
        <Link to='/blog'>
          <ArrowLeft className='size-4' />
          Voltar ao blog
        </Link>
      </Button>

      <header className='space-y-4 border-b pb-6'>
        <h1 className='text-3xl font-bold tracking-tight md:text-4xl'>
          {post.title}
        </h1>
        <div className='flex flex-wrap items-center gap-4 text-sm text-muted-foreground'>
          {post.publishedAt && (
            <span className='inline-flex items-center gap-1.5'>
              <Calendar className='size-4' />
              {formatDate(post.publishedAt)}
            </span>
          )}
          {post.authorName && (
            <span className='inline-flex items-center gap-1.5'>
              <User className='size-4' />
              {post.authorName}
            </span>
          )}
        </div>
        {post.excerpt && (
          <p className='text-lg text-muted-foreground'>{post.excerpt}</p>
        )}
      </header>

      <div className='prose prose-neutral max-w-none whitespace-pre-wrap leading-relaxed dark:prose-invert'>
        {post.content}
      </div>
    </article>
  )
}
