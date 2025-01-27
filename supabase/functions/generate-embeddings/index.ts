import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Hello from Generate Embeddings!")

serve(async (req) => {
  const data = await req.json()
  
  console.log("Received request:", data)
  
  return new Response(
    JSON.stringify({ message: "Hello World!" }),
    { headers: { "Content-Type": "application/json" } }
  )
}) 