import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import asyncHandler from 'express-async-handler'

// Types for KB entities
interface KBCategory {
  id: string
  org_id: string
  name: string
  description?: string
  parent_id?: string
  created_at: string
  created_by: string
}

interface KBArticle {
  id: string
  org_id: string
  title: string
  content: string
  status: 'draft' | 'published' | 'archived'
  is_public: boolean
  metadata: Record<string, unknown>
  title_embedding?: number[]
  content_embedding?: number[]
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
  category?: Pick<KBCategory, 'id' | 'name'>
}

interface KBComment {
  id: string
  article_id: string
  content: string
  created_by: string
  created_at: string
  updated_at: string
  parent_id?: string
  path: string
  depth: number
}

interface KBArticleChunk {
  id: string
  article_id: string
  chunk_index: number
  content: string
  embedding: number[]
  metadata: Record<string, unknown>
  created_at: string
}

// Zod schemas with inferred types
const CategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parent_id: z.string().uuid().optional()
})

const ArticleSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  is_public: z.boolean().default(false)
})

const CommentSchema = z.object({
  content: z.string().min(1),
  parent_id: z.string().uuid().optional()
})

type CategoryInput = z.infer<typeof CategorySchema>
type ArticleInput = z.infer<typeof ArticleSchema>
type CommentInput = z.infer<typeof CommentSchema>

// Query parameter types
interface ArticleQueryParams {
  category_id?: string
  status?: 'draft' | 'published' | 'archived'
  search?: string
}

interface SearchQueryParams {
  q: string
}

// API response types
interface ApiError {
  error: string
}

interface ApiResponse<T> {
  data: T | null
  error: string | null
}

// Supabase response types
interface SupabaseArticleResponse {
  id: string
  org_id: string
  title: string
  content: string
  status: 'draft' | 'published' | 'archived'
  is_public: boolean
  metadata: Record<string, unknown>
  title_embedding?: number[]
  content_embedding?: number[]
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
  category: {
    id: string
    name: string
  }
}

const router: Router = Router()
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// Public routes with typed request/response
router.get('/public/articles', asyncHandler(async (req: Request<{}, ApiResponse<KBArticle[]>, {}, ArticleQueryParams>, res: Response) => {
  const { category_id, search } = req.query
  let query = supabase
    .from('kb_articles')
    .select('*, category:kb_categories(id, name)')
    .eq('status', 'published')
    .eq('is_public', true)

  if (category_id) {
    query = query.eq('category_id', category_id)
  }

  if (search) {
    query = query.textSearch('search_vector', String(search))
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ data: null, error: error.message })
    return
  }
  
  // Transform Supabase response to our API type
  const articles: KBArticle[] = ((data || []) as any[]).map(article => ({
    id: article.id,
    org_id: article.org_id,
    title: article.title,
    content: article.content,
    status: article.status,
    is_public: article.is_public,
    metadata: article.metadata || {},
    title_embedding: article.title_embedding,
    content_embedding: article.content_embedding,
    created_at: article.created_at,
    updated_at: article.updated_at,
    created_by: article.created_by,
    updated_by: article.updated_by,
    category: article.category ? {
      id: article.category.id,
      name: article.category.name
    } : undefined
  }))
  
  res.json({ data: articles, error: null })
}))

router.get('/public/articles/:id', asyncHandler(async (req: Request<{ id: string }>, res: Response<KBArticle>) => {
  const { data, error } = await supabase
    .from('kb_articles')
    .select(`
      *,
      category:kb_categories(id, name),
      comments:kb_article_comments(
        id,
        content,
        created_by,
        created_at,
        parent_id,
        path,
        depth
      )
    `)
    .eq('id', req.params.id)
    .eq('status', 'published')
    .eq('is_public', true)
    .single()

  if (error) {
    res.status(500).json({ error: error.message } as any)
    return
  }
  res.json(data as KBArticle)
}))

router.get('/public/categories', asyncHandler(async (req: Request, res: Response<KBCategory[]>) => {
  const { data, error } = await supabase
    .from('kb_categories')
    .select('*')
    .order('name')

  if (error) {
    res.status(500).json({ error: error.message } as any)
    return
  }
  res.json(data as KBCategory[])
}))

router.get('/public/search', asyncHandler(async (req: Request<{}, KBArticle[], {}, SearchQueryParams>, res: Response<KBArticle[]>) => {
  const { q } = req.query
  if (!q) {
    res.status(400).json({ error: 'Search query required' } as any)
    return
  }

  const { data, error } = await supabase
    .from('kb_articles')
    .select(`
      id,
      title,
      content,
      category_id,
      created_at,
      category:kb_categories(name)
    `)
    .textSearch('search_vector', String(q))
    .eq('status', 'published')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message } as any)
    return
  }
  res.json(data as KBArticle[])
}))

// Protected routes with typed request/response
router.get('/categories', asyncHandler(async (req: Request, res: Response<KBCategory[]>) => {
  const { data, error } = await supabase
    .from('kb_categories')
    .select('*')
    .order('name')

  if (error) {
    res.status(500).json({ error: error.message } as any)
    return
  }
  res.json(data as KBCategory[])
}))

router.post('/categories', asyncHandler(async (req: Request<{}, KBCategory, CategoryInput>, res: Response<KBCategory>) => {
  const result = CategorySchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error } as any)
    return
  }

  const { data, error } = await supabase
    .from('kb_categories')
    .insert(result.data)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message } as any)
    return
  }
  res.json(data as KBCategory)
}))

router.get('/articles', asyncHandler(async (req: Request<{}, KBArticle[], {}, ArticleQueryParams>, res: Response<KBArticle[]>) => {
  const { category_id, status, search } = req.query
  let query = supabase
    .from('kb_articles')
    .select('*, category:kb_categories(name)')

  if (category_id) {
    query = query.eq('category_id', category_id)
  }
  
  if (status) {
    query = query.eq('status', status)
  }

  if (search) {
    query = query.textSearch('search_vector', String(search))
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message } as any)
    return
  }
  res.json(data as KBArticle[])
}))

router.get('/articles/:id', asyncHandler(async (req: Request<{ id: string }>, res: Response<KBArticle>) => {
  const { data, error } = await supabase
    .from('kb_articles')
    .select(`
      *,
      category:kb_categories(id, name),
      comments:kb_article_comments(
        id,
        content,
        created_by,
        created_at,
        parent_id,
        path,
        depth
      )
    `)
    .eq('id', req.params.id)
    .single()

  if (error) {
    res.status(500).json({ error: error.message } as any)
    return
  }
  res.json(data as KBArticle)
}))

router.post('/articles', asyncHandler(async (req: Request<{}, KBArticle, ArticleInput>, res: Response<KBArticle>) => {
  const result = ArticleSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error } as any)
    return
  }

  const { data, error } = await supabase
    .from('kb_articles')
    .insert(result.data)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message } as any)
    return
  }
  res.json(data as KBArticle)
}))

router.patch('/articles/:id', asyncHandler(async (req: Request<{ id: string }, KBArticle, Partial<ArticleInput>>, res: Response<KBArticle>) => {
  const result = ArticleSchema.partial().safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error } as any)
    return
  }

  const { data, error } = await supabase
    .from('kb_articles')
    .update(result.data)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message } as any)
    return
  }
  res.json(data as KBArticle)
}))

router.post('/articles/:id/comments', asyncHandler(async (req: Request<{ id: string }, KBComment, CommentInput>, res: Response<KBComment>) => {
  const result = CommentSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error } as any)
    return
  }

  const { data, error } = await supabase
    .from('kb_article_comments')
    .insert({
      ...result.data,
      article_id: req.params.id
    })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message } as any)
    return
  }
  res.json(data as KBComment)
}))

router.get('/search', asyncHandler(async (req: Request<{}, KBArticle[], {}, SearchQueryParams>, res: Response<KBArticle[]>) => {
  const { q } = req.query
  if (!q) {
    res.status(400).json({ error: 'Search query required' } as any)
    return
  }

  const { data, error } = await supabase
    .from('kb_articles')
    .select(`
      id,
      title,
      content,
      category_id,
      created_at,
      category:kb_categories(name)
    `)
    .textSearch('search_vector', String(q))
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message } as any)
    return
  }
  res.json(data as KBArticle[])
}))

export default router 