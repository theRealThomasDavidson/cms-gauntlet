export interface KBCategory {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
}

export interface KBArticle {
  id: string
  title: string
  content: string
  category_id: string
  category?: KBCategory
  is_published: boolean
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
}

export interface KBComment {
  id: string
  article_id: string
  content: string
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
}

export interface KBArticleChunk {
  id: string
  article_id: string
  content: string
  embedding: number[]
  created_at: string
  updated_at: string
}

export interface APIResponse<T> {
  data?: T
  error?: string
} 