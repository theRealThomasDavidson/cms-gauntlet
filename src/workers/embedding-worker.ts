import { createClient } from '@supabase/supabase-js'
import { Configuration, OpenAIApi } from 'openai'
import dotenv from 'dotenv'

dotenv.config()

const WORKER_ID = `embedding-worker-${process.pid}`
const POLL_INTERVAL = 5000 // 5 seconds
const CHUNK_SIZE = 500
const CHUNK_OVERLAP = 50
const MODEL_NAME = 'text-embedding-ada-002'

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY
  })
)

interface Chunk {
  text: string
  startChar: number
  endChar: number
  tokenCount: number
  sectionTitle?: string
}

// Helper functions from before
function estimateTokenCount(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3)
}

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
      const chunkText = currentChunk.join(' ')
      chunks.push({
        text: chunkText,
        startChar,
        endChar: startChar + chunkText.length,
        tokenCount: currentTokenCount,
        sectionTitle
      })

      const overlapStart = Math.max(0, currentChunk.length - CHUNK_OVERLAP)
      currentChunk = currentChunk.slice(overlapStart)
      startChar += chunkText.slice(0, overlapStart).length
      currentTokenCount = estimateTokenCount(currentChunk.join(' '))
    }

    currentChunk.push(word)
    currentTokenCount += wordTokens
  }

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

async function generateEmbeddings(chunks: Chunk[]): Promise<number[][]> {
  const response = await openai.createEmbedding({
    model: MODEL_NAME,
    input: chunks.map(c => c.text)
  })

  return response.data.data.map(item => item.embedding)
}

// Process a single article
async function processArticle(articleId: string): Promise<void> {
  // Get article content
  const { data: article, error: articleError } = await supabase
    .from('kb_articles')
    .select('title, content')
    .eq('id', articleId)
    .single()

  if (articleError || !article) {
    throw new Error(`Failed to fetch article: ${articleError?.message}`)
  }

  // Generate chunks and embeddings
  const chunks = splitIntoChunks(article.content)
  const embeddings = await generateEmbeddings(chunks)

  // Store chunks
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const embedding = embeddings[i]

    await supabase.rpc('create_article_chunk', {
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

  // Generate and store title embedding
  const titleEmbedding = (await generateEmbeddings([{
    text: article.title,
    startChar: 0,
    endChar: article.title.length,
    tokenCount: estimateTokenCount(article.title)
  }]))[0]

  // Update article
  await supabase
    .from('kb_articles')
    .update({
      title_embedding: titleEmbedding,
      content_embedding: embeddings[0]
    })
    .eq('id', articleId)
}

// Main worker loop
async function processNextJob(): Promise<void> {
  const { data: jobs, error: jobError } = await supabase.rpc(
    'claim_next_job',
    {
      worker_id: WORKER_ID,
      supported_types: ['generate_embeddings'],
      supported_queues: ['embeddings']
    }
  )

  if (jobError) {
    console.error('Error claiming job:', jobError)
    return
  }

  if (!jobs?.length) {
    return // No jobs available
  }

  const job = jobs[0]

  try {
    await processArticle(job.payload.article_id)
    await supabase.rpc('complete_job', { p_job_id: job.id })
  } catch (error) {
    console.error('Error processing job:', error)
    await supabase.rpc('fail_job', {
      p_job_id: job.id,
      p_error: error.message
    })
  }
}

// Start the worker
async function startWorker() {
  console.log(`Starting embedding worker ${WORKER_ID}`)
  
  while (true) {
    try {
      await processNextJob()
    } catch (error) {
      console.error('Worker error:', error)
    }
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
  }
}

startWorker().catch(console.error) 