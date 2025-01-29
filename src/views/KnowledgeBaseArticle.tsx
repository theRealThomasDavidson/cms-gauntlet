import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { KBArticle, APIResponse } from '../types/kb'

interface KnowledgeBaseArticleProps {
  isPublic?: boolean
}

export default function KnowledgeBaseArticle({ isPublic = false }: KnowledgeBaseArticleProps) {
  const [article, setArticle] = useState<KBArticle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { articleId } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    const loadArticle = async () => {
      if (!articleId) {
        setError('Article ID is required')
        return
      }

      try {
        const response = await fetch(`/api/kb/${isPublic ? 'public/' : ''}articles/${articleId}`)
        const result = await response.json() as APIResponse<KBArticle>
        if (result.error) throw new Error(result.error)
        if (result.data) setArticle(result.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load article')
      } finally {
        setIsLoading(false)
      }
    }

    loadArticle()
  }, [articleId, isPublic])

  const handleBack = () => {
    navigate(-1)
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="text-center py-12 text-gray-500">
        Article not found
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        onClick={handleBack}
        className="mb-6 inline-flex items-center text-blue-600 hover:text-blue-800"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </button>

      <article className="bg-white rounded-lg shadow-lg p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
          {article.category && (
            <div className="flex items-center text-sm text-gray-500">
              <span className="mr-2">Category:</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {article.category.name}
              </span>
            </div>
          )}
        </header>

        <div className="prose max-w-none">
          {article.content}
        </div>

        <footer className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-col space-y-2 text-sm text-gray-500">
            <p>Last updated: {new Date(article.updated_at).toLocaleDateString()}</p>
            {!isPublic && (
              <>
                <p>Created by: {article.created_by}</p>
                <p>Last modified by: {article.updated_by}</p>
              </>
            )}
          </div>
        </footer>
      </article>
    </div>
  )
} 