import { createClient } from '@supabase/supabase-js'
import { Configuration, OpenAIApi } from 'openai'
import express from 'express'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

const CHUNK_SIZE = 500  // tokens
const CHUNK_OVERLAP = 50  // tokens
const MODEL_NAME = 'text-embedding-ada-002'

interface Article {
  id: string
  title: string
  content: string
  org_id: string
}

interface Chunk {
  text: string
  startChar: number
  endChar: number
  tokenCount: number
  sectionTitle?: string
}

// Initialize OpenAI
const openAiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})
const openai = new OpenAIApi(openAiConfig)

// Initialize Supabase client
const supabaseClient = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

// Simple token count estimation (can be replaced with more accurate tokenizer)
function estimateTokenCount(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3)
}

// Split text into chunks
function splitIntoChunks(text: string, sectionTitle?: string): Chunk[] {
  const chunks: Chunk[] = []
  const words = text.split(/\s+/)
  let currentChunk: string[] = []
  let currentTokenCount = 0
  let startChar = 0

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const wordTokens = estimateTokenCount(word)

    if (currentTokenCount + wordTokens > CHUNK_SIZE) {
      // Store current chunk
      const chunkText = currentChunk.join(' ')
      chunks.push({
        text: chunkText,
        startChar,
        endChar: startChar + chunkText.length,
        tokenCount: currentTokenCount,
        sectionTitle
      })

      // Start new chunk with overlap
      const overlapStart = Math.max(0, currentChunk.length - CHUNK_OVERLAP)
      currentChunk = currentChunk.slice(overlapStart)
      startChar += chunkText.slice(0, overlapStart).length
      currentTokenCount = estimateTokenCount(currentChunk.join(' '))
    }

    currentChunk.push(word)
    currentTokenCount += wordTokens
  }

  // Add final chunk
  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join(' ')
    chunks.push({
      text: chunkText,
      startChar,
      endChar: startChar + chunkText.length,
      tokenCount: currentTokenCount,
      sectionTitle
    })
  }

  return chunks
}

// Generate embeddings for chunks
async function generateEmbeddings(chunks: Chunk[]): Promise<number[][]> {
  const response = await openai.createEmbedding({
    model: MODEL_NAME,
    input: chunks.map(c => c.text)
  })

  return response.data.data.map(item => item.embedding)
}

// Store chunks and embeddings
async function storeChunks(
  articleId: string,
  chunks: Chunk[],
  embeddings: number[][]
) {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const embedding = embeddings[i]

    await supabaseClient
      .rpc('create_article_chunk', {
        p_article_id: articleId,
        p_chunk_index: i,
        p_chunk_text: chunk.text,
        p_embedding: embedding,
        p_start_char: chunk.startChar,
        p_end_char: chunk.endChar,
        p_token_count: chunk.tokenCount,
        p_section_title: chunk.sectionTitle,
        p_extra_metadata: {}
      })
  }
}

// API endpoint
router.post('/generate', async (req, res) => {
  try {
    const { article } = req.body

    if (!article?.id || !article?.content) {
      return res.status(400).json({ error: 'Missing article data' })
    }

    // Split content into chunks
    const chunks = splitIntoChunks(article.content)
    
    // Generate embeddings
    const embeddings = await generateEmbeddings(chunks)

    // Store chunks with embeddings
    await storeChunks(article.id, chunks, embeddings)

    // Generate and store title embedding separately
    const titleEmbedding = (await generateEmbeddings([{ 
      text: article.title,
      startChar: 0,
      endChar: article.title.length,
      tokenCount: estimateTokenCount(article.title)
    }]))[0]

    // Update article with title embedding
    await supabaseClient
      .from('kb_articles')
      .update({ 
        title_embedding: titleEmbedding,
        content_embedding: embeddings[0] // Use first chunk as content embedding
      })
      .eq('id', article.id)

    res.json({ success: true })

  } catch (error) {
    console.error('Error generating embeddings:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router 