import { createFileRoute } from '@tanstack/react-router'
import { AdminBlogPostsPage } from '@/features/admin/blog-posts-page'

export const Route = createFileRoute('/_authenticated/admin/blog')({
  component: AdminBlogPostsPage,
})
