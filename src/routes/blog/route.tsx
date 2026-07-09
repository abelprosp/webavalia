import { createFileRoute, Outlet } from '@tanstack/react-router'
import { BlogLayout } from '@/features/blog/blog-layout'

export const Route = createFileRoute('/blog')({
  component: () => (
    <BlogLayout>
      <Outlet />
    </BlogLayout>
  ),
})
