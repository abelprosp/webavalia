import { Router } from 'express'
import {
  getPublishedPostBySlug,
  listPublishedPosts,
} from '../services/blog-service.js'

const router = Router()

router.get('/', async (_req, res) => {
  const posts = await listPublishedPosts()
  return res.json({
    posts: posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      authorName: post.authorName,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
    })),
  })
})

router.get('/:slug', async (req, res) => {
  const slug = String(req.params.slug)
  const post = await getPublishedPostBySlug(slug)

  if (!post) {
    return res.status(404).json({ message: 'Post não encontrado.' })
  }

  return res.json({ post })
})

export default router
