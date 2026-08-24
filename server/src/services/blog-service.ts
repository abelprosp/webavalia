import { pool } from '../db/pool.js'

export type BlogPostRow = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  status: 'draft' | 'published'
  author_id: string | null
  author_name: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type BlogPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  status: 'draft' | 'published'
  authorId: string | null
  authorName: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

function mapPost(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    status: row.status,
    authorId: row.author_id,
    authorName: row.author_name,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const POST_SELECT = `
  SELECT
    p.id,
    p.slug,
    p.title,
    p.excerpt,
    p.content,
    p.status,
    p.author_id,
    u.name AS author_name,
    p.published_at,
    p.created_at,
    p.updated_at
  FROM blog_posts p
  LEFT JOIN users u ON u.id = p.author_id
`

export function slugify(title: string) {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
}

async function ensureUniqueSlug(base: string, excludeId?: string) {
  const slug = base || 'post'
  let suffix = 0

  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`
    const params: unknown[] = [candidate]
    let query = 'SELECT id FROM blog_posts WHERE slug = $1'
    if (excludeId) {
      params.push(excludeId)
      query += ' AND id != $2'
    }
    const existing = await pool.query(query, params)
    if (!existing.rowCount) return candidate
    suffix += 1
  }
}

export async function listPublishedPosts(limit = 50) {
  const result = await pool.query<BlogPostRow>(
    `${POST_SELECT}
     WHERE p.status = 'published'
     ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
     LIMIT $1`,
    [limit]
  )
  return result.rows.map(mapPost)
}

export async function getPublishedPostBySlug(slug: string) {
  const result = await pool.query<BlogPostRow>(
    `${POST_SELECT}
     WHERE p.slug = $1 AND p.status = 'published'
     LIMIT 1`,
    [slug]
  )
  return result.rows[0] ? mapPost(result.rows[0]) : null
}

export async function listAllPosts() {
  const result = await pool.query<BlogPostRow>(
    `${POST_SELECT}
     ORDER BY p.updated_at DESC`
  )
  return result.rows.map(mapPost)
}

export async function getPostById(id: string) {
  const result = await pool.query<BlogPostRow>(
    `${POST_SELECT} WHERE p.id = $1 LIMIT 1`,
    [id]
  )
  return result.rows[0] ? mapPost(result.rows[0]) : null
}

export async function createPost(input: {
  title: string
  excerpt?: string | null
  content: string
  status: 'draft' | 'published'
  authorId: string
  slug?: string
}) {
  const baseSlug = slugify(input.slug?.trim() || input.title)
  const slug = await ensureUniqueSlug(baseSlug)
  const publishedAt = input.status === 'published' ? new Date().toISOString() : null

  const result = await pool.query<BlogPostRow>(
    `INSERT INTO blog_posts (slug, title, excerpt, content, status, author_id, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, slug, title, excerpt, content, status, author_id, NULL::text AS author_name, published_at, created_at, updated_at`,
    [
      slug,
      input.title.trim(),
      input.excerpt?.trim() || null,
      input.content.trim(),
      input.status,
      input.authorId,
      publishedAt,
    ]
  )

  const created = await getPostById(result.rows[0].id)
  if (!created) throw new Error('Falha ao criar post.')
  return created
}

export async function updatePost(
  id: string,
  input: Partial<{
    title: string
    excerpt: string | null
    content: string
    status: 'draft' | 'published'
    slug: string
  }>
) {
  const current = await getPostById(id)
  if (!current) return null

  const fields: string[] = []
  const values: unknown[] = []
  let index = 1

  if (input.title !== undefined) {
    fields.push(`title = $${index++}`)
    values.push(input.title.trim())
  }

  if (input.excerpt !== undefined) {
    fields.push(`excerpt = $${index++}`)
    values.push(input.excerpt?.trim() || null)
  }

  if (input.content !== undefined) {
    fields.push(`content = $${index++}`)
    values.push(input.content.trim())
  }

  if (input.slug !== undefined) {
    const baseSlug = slugify(input.slug.trim())
    const uniqueSlug = await ensureUniqueSlug(baseSlug, id)
    fields.push(`slug = $${index++}`)
    values.push(uniqueSlug)
  } else if (input.title !== undefined) {
    const baseSlug = slugify(input.title)
    const uniqueSlug = await ensureUniqueSlug(baseSlug, id)
    fields.push(`slug = $${index++}`)
    values.push(uniqueSlug)
  }

  if (input.status !== undefined) {
    fields.push(`status = $${index++}`)
    values.push(input.status)

    if (input.status === 'published' && !current.publishedAt) {
      fields.push(`published_at = $${index++}`)
      values.push(new Date().toISOString())
    }

    if (input.status === 'draft') {
      fields.push(`published_at = $${index++}`)
      values.push(null)
    }
  }

  if (!fields.length) return current

  fields.push('updated_at = NOW()')
  values.push(id)

  await pool.query(
    `UPDATE blog_posts SET ${fields.join(', ')} WHERE id = $${index}`,
    values
  )

  return getPostById(id)
}

export async function deletePost(id: string) {
  const result = await pool.query(
    'DELETE FROM blog_posts WHERE id = $1 RETURNING id',
    [id]
  )
  return Boolean(result.rowCount)
}
