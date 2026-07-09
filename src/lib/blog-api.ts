import { api } from './api'

export type BlogPostSummary = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  authorName: string | null
  publishedAt: string | null
  createdAt: string
}

export type BlogPost = BlogPostSummary & {
  content: string
  status: 'draft' | 'published'
  authorId: string | null
  updatedAt: string
}

export async function fetchBlogPosts() {
  const { data } = await api.get<{ posts: BlogPostSummary[] }>('/blog')
  return data.posts
}

export async function fetchBlogPost(slug: string) {
  const { data } = await api.get<{ post: BlogPost }>(`/blog/${slug}`)
  return data.post
}
