import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { KBArticle, KBCategory, APIResponse } from '../types/kb'

interface KnowledgeBaseProps {
  isPublic?: boolean
}

export default function KnowledgeBase({ isPublic = false }: KnowledgeBaseProps) {
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [categories, setCategories] = useState<KBCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const navigate = useNavigate()
  const { categoryId } = useParams()

  useEffect(() => {
    // Load categories
    const loadCategories = async () => {
      try {
        const response = await fetch(`/api/kb/${isPublic ? 'public/' : ''}categories`)
        const result = await response.json() as APIResponse<KBCategory[]>
        if (result.error) throw new Error(result.error)
        if (result.data) setCategories(result.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load categories')
      }
    }

    loadCategories()
  }, [isPublic])

  useEffect(() => {
    // Load articles
    const loadArticles = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedCategory) params.append('category_id', selectedCategory)
        if (searchQuery) params.append('search', searchQuery)

        const response = await fetch(`/api/kb/${isPublic ? 'public/' : ''}articles?${params}`)
        const result = await response.json() as APIResponse<KBArticle[]>
        if (result.error) throw new Error(result.error)
        if (result.data) setArticles(result.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load articles')
      } finally {
        setIsLoading(false)
      }
    }

    loadArticles()
  }, [isPublic, selectedCategory, searchQuery])

  useEffect(() => {
    if (categoryId) {
      setSelectedCategory(categoryId)
    }
  }, [categoryId])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategory(categoryId)
    if (categoryId) {
      navigate(`/kb/category/${categoryId}`)
    } else {
      navigate('/kb')
    }
  }

  const handleArticleSelect = (articleId: string) => {
    navigate(`/kb/article/${articleId}`)
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Categories</h2>
            <nav>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => handleCategorySelect(null)}
                    className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${
                      !selectedCategory ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  >
                    All Articles
                  </button>
                </li>
                {categories.map(category => (
                  <li key={category.id}>
                    <button
                      onClick={() => handleCategorySelect(category.id)}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${
                        selectedCategory === category.id ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      {category.name}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="search"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="absolute right-3 top-2.5 text-gray-400">
                {/* Search icon */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>
          </div>

          {/* Articles */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : articles.length > 0 ? (
            <div className="space-y-4">
              {articles.map(article => (
                <article
                  key={article.id}
                  onClick={() => handleArticleSelect(article.id)}
                  className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <h2 className="text-xl font-semibold mb-2">{article.title}</h2>
                  <p className="text-gray-600 line-clamp-2">{article.content}</p>
                  {article.category && (
                    <div className="mt-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {article.category.name}
                      </span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No articles found
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 