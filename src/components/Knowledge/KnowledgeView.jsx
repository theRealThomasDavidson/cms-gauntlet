import { Search, Plus, ArrowLeft, Save, Upload, X } from 'lucide-react'
import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import TestEmbeddings from './TestEmbeddings'

export default function KnowledgeView({ profile }) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [articles, setArticles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_public: true,
    status: 'draft'
  })
  const [attachments, setAttachments] = useState([])
  const [uploadError, setUploadError] = useState('')
  const canAddArticles = profile?.role === 'admin' || profile?.role === 'agent'

  useEffect(() => {
    const fetchArticles = async () => {
      setIsLoading(true)
      try {
        let query = supabase
          .from('kb_articles')
          .select('*')
          .order('created_at', { ascending: false })

        if (searchQuery) {
          query = query.textSearch('title', searchQuery)
        }

        const { data, error } = await query

        if (error) throw error
        setArticles(data || [])
      } catch (err) {
        console.error('Error fetching articles:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchArticles()
  }, [searchQuery])

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    setUploadError('')

    // Only accept image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    if (imageFiles.length !== files.length) {
      setUploadError('Only image files are allowed')
      return
    }

    const newAttachments = imageFiles.map(file => ({
      file,
      name: file.name,
      size: file.size,
      preview: URL.createObjectURL(file)
    }))

    setAttachments([...attachments, ...newAttachments])
  }

  const removeAttachment = (index) => {
    const newAttachments = [...attachments]
    if (newAttachments[index].preview) {
      URL.revokeObjectURL(newAttachments[index].preview)
    }
    newAttachments.splice(index, 1)
    setAttachments(newAttachments)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      // First create the article
      const { data: article, error: articleError } = await supabase
        .rpc('create_knowledge_article', {
          p_title: formData.title,
          p_content: formData.content,
          p_is_public: formData.is_public,
          p_status: formData.status
        })

      if (articleError) throw articleError

      // Upload and validate each image
      for (const attachment of attachments) {
        const formData = new FormData()
        formData.append('file', attachment.file)
        formData.append('articleId', article.id)

        const { data, error } = await supabase.functions.invoke('validate-file-upload', {
          body: formData
        })

        if (error) throw error
      }

      // Reset form and go back to list view
      setFormData({
        title: '',
        content: '',
        is_public: true,
        status: 'draft'
      })
      setAttachments([])
      setIsEditMode(false)
    } catch (error) {
      setUploadError(error.message)
    }
  }

  const handleTestEmbeddings = async () => {
    try {
      const { data, error } = await supabase
        .from('kb_articles')
        .insert({
          title: 'Test Article for Embeddings',
          content: 'This is a test article to verify that our embeddings function is working correctly. It should trigger the Edge Function when is_public is set to true.',
          is_public: true,
          status: 'published',
          org_id: profile.org_id,
          created_by: profile.id,
          updated_by: profile.id
        })
        .select()
        .single()

      if (error) throw error
      alert('Test article created! Check the function logs.')
    } catch (err) {
      alert('Error creating test article: ' + err.message)
    }
  }

  const handleSearch = (value) => {
    setSearchQuery(value)
  }

  if (isEditMode) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => setIsEditMode(false)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Articles
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Save className="h-5 w-5" />
            Save Article
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            <textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-64"
              required
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_public"
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_public" className="text-sm text-gray-700">
                Make article public
              </label>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              <label className="text-sm text-gray-700">
                Status
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Images
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                    <span>Upload images</span>
                    <input
                      id="file-upload"
                      type="file"
                      className="sr-only"
                      multiple
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  Images will be validated and optimized
                </p>
              </div>
            </div>
            {uploadError && (
              <p className="mt-2 text-sm text-red-600">{uploadError}</p>
            )}
            {attachments.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                {attachments.map((attachment, index) => (
                  <div key={index} className="relative group">
                    <img 
                      src={attachment.preview} 
                      alt="" 
                      className="w-full h-40 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                    <p className="mt-1 text-sm text-gray-500">{attachment.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Knowledge Base</h2>
        <div className="flex gap-2">
          {canAddArticles && (
            <>
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                onClick={handleTestEmbeddings}
              >
                Test Embeddings
              </button>
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                onClick={() => setIsEditMode(true)}
              >
                <Plus className="h-5 w-5" />
                Add Article
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add TestEmbeddings component */}
      {canAddArticles && (
        <div className="mb-8">
          <TestEmbeddings profile={profile} />
        </div>
      )}

      <div className="relative mb-8">
        <input
          type="text"
          placeholder="Search knowledge base..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : articles.length > 0 ? (
          articles.map(article => (
            <article 
              key={article.id} 
              className="p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-colors cursor-pointer"
            >
              <h3 className="text-xl font-semibold mb-2 text-gray-900">
                {article.title}
              </h3>
              <p className="text-gray-600 mb-4 line-clamp-2">
                {article.content}
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>
                  {article.created_at ? new Date(article.created_at).toLocaleDateString() : 'Date not available'}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  article.status === 'published' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {article.status}
                </span>
                {!article.is_public && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                    Internal Only
                  </span>
                )}
              </div>
            </article>
          ))
        ) : (
          <p className="text-gray-600 text-center py-8">
            No articles found. {canAddArticles && 'Click the Add Article button to create one!'}
          </p>
        )}
      </div>
    </div>
  )
}

KnowledgeView.propTypes = {
  profile: PropTypes.shape({
    role: PropTypes.string
  })
} 