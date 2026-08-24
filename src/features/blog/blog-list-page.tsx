import { Link } from '@tanstack/react-router'
import { Calendar, User } from 'lucide-react'
import type { BlogPostSummary } from '@/lib/blog-api'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type BlogListPageProps = {
  posts: BlogPostSummary[]
}

function formatDate(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function BlogListPage({ posts }: BlogListPageProps) {
  return (
    <div className='space-y-8'>
      <div>
        <Badge variant='secondary' className='mb-3 rounded-full'>
          Blog
        </Badge>
        <h1 className='text-3xl font-bold tracking-tight md:text-4xl'>
          Mercado imobiliário e avaliações
        </h1>
        <p className='mt-2 max-w-2xl text-muted-foreground'>
          Artigos sobre valuation, tendências de mercado, metodologia NBR 14653
          e dicas para corretores e investidores.
        </p>
      </div>

      {posts.length === 0 ? (
        <Card className='rounded-[1.75rem] border-dashed'>
          <CardContent className='py-12 text-center text-muted-foreground'>
            Nenhum artigo publicado ainda. Volte em breve!
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4'>
          {posts.map((post) => (
            <Link key={post.id} to='/blog/$slug' params={{ slug: post.slug }}>
              <Card className='rounded-[1.75rem] border-black/[0.04] shadow-sm transition-shadow hover:shadow-md'>
                <CardHeader>
                  <CardTitle className='text-xl leading-snug hover:text-primary'>
                    {post.title}
                  </CardTitle>
                  {post.excerpt && (
                    <p className='line-clamp-2 text-sm text-muted-foreground'>
                      {post.excerpt}
                    </p>
                  )}
                </CardHeader>
                <CardContent className='flex flex-wrap items-center gap-4 text-xs text-muted-foreground'>
                  {post.publishedAt && (
                    <span className='inline-flex items-center gap-1'>
                      <Calendar className='size-3.5' />
                      {formatDate(post.publishedAt)}
                    </span>
                  )}
                  {post.authorName && (
                    <span className='inline-flex items-center gap-1'>
                      <User className='size-3.5' />
                      {post.authorName}
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
