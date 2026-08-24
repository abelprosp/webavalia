import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createAdminBlogPost,
  deleteAdminBlogPost,
  fetchAdminBlogPosts,
  updateAdminBlogPost,
  type AdminBlogPost,
} from '@/lib/admin-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

const emptyPost: {
  title: string
  excerpt: string
  content: string
  status: 'draft' | 'published'
  slug: string
} = {
  title: '',
  excerpt: '',
  content: '',
  status: 'draft',
  slug: '',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR')
}

export function AdminBlogPostsPage() {
  const [posts, setPosts] = useState<AdminBlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminBlogPost | null>(null)
  const [form, setForm] = useState(emptyPost)
  const [saving, setSaving] = useState(false)

  async function loadPosts() {
    setLoading(true)
    try {
      setPosts(await fetchAdminBlogPosts())
    } catch {
      toast.error('Erro ao carregar postagens.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyPost)
    setDialogOpen(true)
  }

  function openEdit(post: AdminBlogPost) {
    setEditing(post)
    setForm({
      title: post.title,
      excerpt: post.excerpt ?? '',
      content: post.content,
      status: post.status,
      slug: post.slug,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Preencha título e conteúdo.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        excerpt: form.excerpt.trim() || null,
        content: form.content.trim(),
        status: form.status,
        ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      }

      if (editing) {
        const updated = await updateAdminBlogPost(editing.id, payload)
        setPosts((prev) => prev.map((p) => (p.id === editing.id ? updated : p)))
        toast.success('Postagem atualizada.')
      } else {
        const created = await createAdminBlogPost(payload)
        setPosts((prev) => [created, ...prev])
        toast.success('Postagem criada.')
      }
      setDialogOpen(false)
    } catch {
      toast.error('Erro ao salvar postagem.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(post: AdminBlogPost) {
    if (!confirm(`Excluir a postagem "${post.title}"?`)) return
    try {
      await deleteAdminBlogPost(post.id)
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
      toast.success('Postagem excluída.')
    } catch {
      toast.error('Erro ao excluir postagem.')
    }
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <div>
            <CardTitle>Blog</CardTitle>
            <CardDescription>
              Crie e publique artigos visíveis em /blog
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className='size-4' />
            Nova postagem
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' />
              Carregando postagens...
            </div>
          ) : posts.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              Nenhuma postagem ainda. Crie a primeira!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Publicado</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className='text-right'>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div className='font-medium'>{post.title}</div>
                      <div className='text-xs text-muted-foreground'>
                        /blog/{post.slug}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          post.status === 'published' ? 'default' : 'secondary'
                        }
                      >
                        {post.status === 'published' ? 'Publicado' : 'Rascunho'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(post.publishedAt)}</TableCell>
                    <TableCell>{formatDate(post.updatedAt)}</TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        {post.status === 'published' && (
                          <Button size='sm' variant='ghost' asChild>
                            <Link
                              to='/blog/$slug'
                              params={{ slug: post.slug }}
                              target='_blank'
                            >
                              <ExternalLink className='size-4' />
                            </Link>
                          </Button>
                        )}
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => openEdit(post)}
                        >
                          Editar
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => handleDelete(post)}
                        >
                          <Trash2 className='size-4' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar postagem' : 'Nova postagem'}
            </DialogTitle>
          </DialogHeader>
          <div className='grid gap-4'>
            <div className='space-y-2'>
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder='Ex: Como avaliar um imóvel em 2026'
              />
            </div>
            <div className='space-y-2'>
              <Label>Slug (opcional)</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder='como-avaliar-imovel-2026'
              />
            </div>
            <div className='space-y-2'>
              <Label>Resumo</Label>
              <Textarea
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                placeholder='Breve descrição exibida na listagem'
                rows={2}
              />
            </div>
            <div className='space-y-2'>
              <Label>Conteúdo</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder='Texto completo do artigo'
                rows={12}
              />
            </div>
            <div className='space-y-2'>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value: 'draft' | 'published') =>
                  setForm({ ...form, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='draft'>Rascunho</SelectItem>
                  <SelectItem value='published'>Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
