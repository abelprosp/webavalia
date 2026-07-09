import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BlogPostPage } from '@/features/blog/blog-post-page'
import { fetchBlogPost, type BlogPost } from '@/lib/blog-api'

export const Route = createFileRoute('/blog/$slug')({
  component: BlogPostRoute,
})

function BlogPostRoute() {
  const { slug } = Route.useParams()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    fetchBlogPost(slug)
      .then(setPost)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className='flex items-center gap-2 text-muted-foreground'>
        <Loader2 className='size-4 animate-spin' />
        Carregando artigo...
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className='space-y-4 py-12 text-center'>
        <h1 className='text-2xl font-bold'>Artigo não encontrado</h1>
        <p className='text-muted-foreground'>
          Este artigo não existe ou ainda não foi publicado.
        </p>
        <Button asChild className='rounded-full'>
          <Link to='/blog'>Ver todos os artigos</Link>
        </Button>
      </div>
    )
  }

  return <BlogPostPage post={post} />
}
