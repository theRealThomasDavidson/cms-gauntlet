import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import PropTypes from 'prop-types'

function TestEmbeddings({ profile }) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleTest = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const { data, error } = await supabase
        .rpc('create_knowledge_article', {
          p_title: 'Test Article for Embeddings',
          p_content: 'This is a test article to verify that our embeddings function is working correctly. It should trigger the Edge Function when is_public is set to true.',
          p_is_public: true,
          p_status: 'published'
        })

      if (error) throw error
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-4 border rounded-lg bg-white">
      <h3 className="text-lg font-semibold mb-4">Test Embeddings Function</h3>
      
      <button
        onClick={handleTest}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {isLoading ? 'Creating Test Article...' : 'Create Test Article'}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">
          <p>Article created successfully!</p>
          <p className="text-sm mt-2">ID: {result.id}</p>
          <p className="text-sm">Check the function logs to see the embedding generation.</p>
        </div>
      )}
    </div>
  )
}

TestEmbeddings.propTypes = {
  profile: PropTypes.shape({
    id: PropTypes.string.isRequired,
    org_id: PropTypes.string.isRequired
  }).isRequired
}

export default TestEmbeddings 