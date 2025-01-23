import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const router = express.Router()
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// Validation schemas
const CategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parent_id: z.string().uuid().optional()
})

const ArticleSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft')
})

const CommentSchema = z.object({
  content: z.string().min(1),
  parent_id: z.string().uuid().optional()
})

// Categories
router.get('/categories', async (req, res) => {
  const { data, error } = await supabase
    .from('kb_categories')
    .select('*')
    .order('name')

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/categories', async (req, res) => {
  const result = CategorySchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error })
  }

  const { data, error } = await supabase
    .from('kb_categories')
    .insert(result.data)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Articles
router.get('/articles', async (req, res) => {
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

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/articles/:id', async (req, res) => {
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

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/articles', async (req, res) => {
  const result = ArticleSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error })
  }

  const { data, error } = await supabase
    .from('kb_articles')
    .insert(result.data)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.patch('/articles/:id', async (req, res) => {
  const result = ArticleSchema.partial().safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error })
  }

  const { data, error } = await supabase
    .from('kb_articles')
    .update(result.data)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Comments
router.post('/articles/:id/comments', async (req, res) => {
  const result = CommentSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error })
  }

  const { data, error } = await supabase
    .from('kb_article_comments')
    .insert({
      ...result.data,
      article_id: req.params.id
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Search
router.get('/search', async (req, res) => {
  const { q } = req.query
  if (!q) {
    return res.status(400).json({ error: 'Search query required' })
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

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router 