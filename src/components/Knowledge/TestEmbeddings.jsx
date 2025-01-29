import { supabase } from '../../lib/supabaseClient'

function TestEmbeddings() {
  const test = () => {
    supabase.functions.invoke('hello-world', {
      body: { message: 'Hello!' }
    })
    .then(({ data, error }) => {
      if (error) console.error('Error:', error)
      else console.log('Response:', data)
    })
  }

  return <button onClick={test}>Test Edge Function</button>
}

export default TestEmbeddings 